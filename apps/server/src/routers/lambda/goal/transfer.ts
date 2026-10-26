import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router } from '@/libs/trpc/lambda';
import { GoalCopyService } from '@/server/services/goal/copy';
import { hasWorkspaceScopedPermission } from '@/server/services/workspacePermission';
import { TransferErrorCode } from '@/types/transferError';

import { goalWriteProcedure, mapGoalError } from '../goalProcedures';

export const transferRouter = router({
  /**
   * Copy a goal's definition into personal or another workspace. Moving is
   * intentionally not offered, for the same reason tasks only copy: a goal
   * drags its graph Tasks and their history with it. Permissions match
   * `copyTaskToWorkspace`: `agent:update` in the source scope and
   * `AGENT_UPDATE` on the target workspace; personal needs no target check.
   */
  copyGoalToWorkspace: goalWriteProcedure
    .input(z.object({ id: z.string(), targetWorkspaceId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetWorkspaceId) {
        const canWriteTarget = await hasWorkspaceScopedPermission({
          action: 'AGENT_UPDATE',
          db: ctx.serverDB,
          userId: ctx.userId,
          workspaceId: input.targetWorkspaceId,
        });
        if (!canWriteTarget) {
          throw new TRPCError({
            cause: { data: { code: TransferErrorCode.TargetNoWriteAccess } },
            code: 'FORBIDDEN',
            message: 'No write access to target workspace',
          });
        }
      }

      try {
        return await new GoalCopyService(
          ctx.serverDB,
          ctx.userId,
          ctx.workspaceId ?? undefined,
        ).copyToWorkspace(input.id, input.targetWorkspaceId);
      } catch (error) {
        mapGoalError(error, 'copy');
      }
    }),
});
