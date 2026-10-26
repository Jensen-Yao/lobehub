import type { TrashProjectFilter } from '@lobechat/types';
import { TRASH_RESOURCE_TYPES } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { wsCompatProcedure } from '@/business/server/trpc-middlewares/workspaceAuth';
import { ProjectModel } from '@/database/models/project';
import { router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { TrashService } from '@/server/services/trash';

const trashProcedure = wsCompatProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const wsId = ctx.workspaceId ?? undefined;
  return opts.next({
    ctx: {
      projectModel: new ProjectModel(ctx.serverDB, ctx.userId, wsId),
      trashService: new TrashService(ctx.serverDB, ctx.userId, wsId),
    },
  });
});

const resourceTypeSchema = z.enum(TRASH_RESOURCE_TYPES);
/** `undefined` = every project, `null` = roots without a project, a string = that project. */
const projectFilterSchema = z.string().min(1).nullable().optional();

/**
 * Recycle bin. Every bin lists only the roots the caller trashed, in personal
 * mode and in a workspace alike, whatever the caller's role: a root can be a
 * member's private agent or topic, and its title a content excerpt, so not
 * even the owner sees another member's deletions. Only the deleter may
 * restore or purge a row by id.
 *
 * Workspace owners and admins get the one thing they need to keep the
 * workspace tidy: how many roots each member has in the bin, and a sweep that
 * permanently empties one member's bin — never its titles or a restore.
 */
export const trashRouter = router({
  countByType: trashProcedure
    .input(z.object({ projectId: projectFilterSchema }).optional())
    .query(async ({ input, ctx }) => {
      await assertProjectFilterReadable(ctx, input?.projectId);
      return ctx.trashService.countByType({
        deletedByUserId: actorFilter(ctx),
        projectId: input?.projectId,
      });
    }),

  emptyTrash: trashProcedure
    .input(
      z
        .object({
          projectId: projectFilterSchema,
          resourceType: resourceTypeSchema.optional(),
          /**
           * Scope the client started emptying in (`null` = personal). The
           * request's own workspace context still decides what is reachable;
           * this only refuses a batch that would land in another scope after
           * the user switched workspace mid-sweep, so a sweep never widens.
           */
          workspaceId: z.string().nullable().optional(),
        })
        .optional(),
    )
    .mutation(async ({ input, ctx }) => {
      if (input?.workspaceId !== undefined && input.workspaceId !== (ctx.workspaceId ?? null)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'The active workspace changed while emptying the trash',
        });
      }
      await assertProjectFilterReadable(ctx, input?.projectId);
      // The actor filter is pushed into the query rather than applied to a
      // page of results, so a member with more items than one page still
      // empties all of them.
      return ctx.trashService.emptyTrash({
        deletedByUserId: actorFilter(ctx),
        projectId: input?.projectId,
        resourceType: input?.resourceType,
      });
    }),

  emptyMemberTrash: trashProcedure
    .input(
      z.object({
        memberId: z.string().min(1),
        /** Workspace the sweep started in; a batch landing in another scope is refused. */
        workspaceId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertWorkspaceManager(ctx);
      if (input.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'The active workspace changed while emptying the trash',
        });
      }
      if (input.memberId === ctx.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Empty your own trash through emptyTrash',
        });
      }
      return ctx.trashService.emptyMemberTrash(input.memberId);
    }),

  list: trashProcedure
    .input(
      z
        .object({
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(200).optional(),
          projectId: projectFilterSchema,
          resourceType: resourceTypeSchema.optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      await assertProjectFilterReadable(ctx, input?.projectId);
      return ctx.trashService.list({
        cursor: input?.cursor,
        deletedByUserId: actorFilter(ctx),
        limit: input?.limit,
        projectId: input?.projectId,
        resourceType: input?.resourceType,
      });
    }),

  /** Roots per other member in the workspace bin — counts only, for owners and admins. */
  memberSummary: trashProcedure.query(async ({ ctx }) => {
    assertWorkspaceManager(ctx);
    const rows = await ctx.trashService.countByDeleter();
    return rows.filter((row) => row.userId !== ctx.userId);
  }),

  purge: trashProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      await assertItemsManageable(ctx, input.ids);
      return ctx.trashService.purge(input.ids);
    }),

  restore: trashProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      await assertItemsManageable(ctx, input.ids);
      return ctx.trashService.restore(input.ids);
    }),
});

/**
 * A project filter must name a project the caller can read in the current
 * scope — the same visibility the project list applies (scope, private
 * projects of other members, deleted projects). Filtering by any other id
 * would let the caller probe which roots belong to a project they cannot see,
 * or sweep by it; a deleted or revoked project is reported as `NOT_FOUND` so
 * the client can tell "project unavailable" from "nothing in it".
 */
const assertProjectFilterReadable = async (
  ctx: { projectModel: ProjectModel },
  projectId: TrashProjectFilter,
) => {
  if (typeof projectId !== 'string') return;
  if (await ctx.projectModel.findById(projectId)) return;
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
};

interface TrashCallerCtx {
  userId: string;
  workspaceId?: string | null;
  workspaceRole?: string;
}

/**
 * Every workspace caller, owner included, only sees and sweeps the roots they
 * trashed themselves. Personal rows are already the caller's own.
 */
const actorFilter = (ctx: TrashCallerCtx) => (ctx.workspaceId ? ctx.userId : undefined);

/**
 * Member summaries and member sweeps are for workspace owners and admins.
 * Reads `workspaceRole` through the optional ctx field because the OSS
 * `withScopedPermission` stub does not inject it (cloud's override does).
 */
const assertWorkspaceManager = (ctx: TrashCallerCtx) => {
  if (ctx.workspaceId && (ctx.workspaceRole === 'owner' || ctx.workspaceRole === 'admin')) return;
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Only a workspace owner or admin can manage members’ trash',
  });
};

/** Every requested registry row must have been trashed by the caller. */
const assertItemsManageable = async (
  ctx: TrashCallerCtx & { trashService: TrashService },
  ids: string[],
) => {
  if (!ctx.workspaceId) return;
  const items = await ctx.trashService.findByIds(ids);
  for (const item of items) {
    if ((item.deletedByUserId ?? item.userId) !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the member who deleted this trash item can restore or purge it',
      });
    }
  }
};

export type TrashRouter = typeof trashRouter;
