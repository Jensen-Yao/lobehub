// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// serverDatabase middleware calls getServerDB(); the service is mocked, so the
// handle it returns is never dereferenced.
vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(function () {
    return {};
  }),
}));

const mockList = vi.fn(async () => ({ items: [], nextCursor: null }));
const mockCountByType = vi.fn(async () => ({}));
const mockEmptyTrash = vi.fn(async () => ({ purged: 0 }));
const mockCountByDeleter = vi.fn(async () => [
  { total: 3, userId: 'member-1' },
  { total: 1, userId: 'owner-1' },
]);
const mockEmptyMemberTrash = vi.fn(async () => ({ hasMore: false, purged: 3 }));
const mockFindByIds = vi.fn(async () => [{ deletedByUserId: 'member-1', id: 'trash-1' }]);
const mockRestore = vi.fn(async () => ({ failed: [], restored: [] }));
const mockPurge = vi.fn(async () => ({ purged: 1 }));
vi.mock('@/server/services/trash', () => ({
  TrashService: vi.fn(function () {
    return {
      countByDeleter: mockCountByDeleter,
      countByType: mockCountByType,
      emptyMemberTrash: mockEmptyMemberTrash,
      emptyTrash: mockEmptyTrash,
      findByIds: mockFindByIds,
      list: mockList,
      purge: mockPurge,
      restore: mockRestore,
    };
  }),
}));

const { trashRouter } = await import('../trash');

const owner: any = { serverDB: {}, userId: 'owner-1', workspaceId: 'ws-1', workspaceRole: 'owner' };
const admin: any = { ...owner, userId: 'admin-1', workspaceRole: 'admin' };
const member: any = { ...owner, userId: 'member-1', workspaceRole: 'member' };
const personal: any = { serverDB: {}, userId: 'user-1' };

describe('trashRouter visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits every workspace role, owner included, to the roots they trashed themselves', async () => {
    for (const ctx of [owner, admin, member]) {
      const caller = trashRouter.createCaller(ctx);
      await caller.list({ resourceType: 'message' });
      await caller.countByType();
      await caller.emptyTrash({ workspaceId: 'ws-1' });

      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ deletedByUserId: ctx.userId, resourceType: 'message' }),
      );
      expect(mockCountByType).toHaveBeenLastCalledWith({ deletedByUserId: ctx.userId });
      expect(mockEmptyTrash).toHaveBeenLastCalledWith(
        expect.objectContaining({ deletedByUserId: ctx.userId }),
      );
    }
  });

  it('keeps a personal bin unfiltered (it only holds the caller’s rows)', async () => {
    const caller = trashRouter.createCaller(personal);
    await caller.list();
    await caller.countByType();

    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ deletedByUserId: undefined }),
    );
    expect(mockCountByType).toHaveBeenLastCalledWith({ deletedByUserId: undefined });
  });

  it('lets only the deleter restore or purge a row, not the workspace owner', async () => {
    const asOwner = trashRouter.createCaller(owner);
    await expect(asOwner.restore({ ids: ['trash-1'] })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(asOwner.purge({ ids: ['trash-1'] })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mockRestore).not.toHaveBeenCalled();
    expect(mockPurge).not.toHaveBeenCalled();

    const asMember = trashRouter.createCaller(member);
    await asMember.restore({ ids: ['trash-1'] });
    await asMember.purge({ ids: ['trash-1'] });
    expect(mockRestore).toHaveBeenCalledWith(['trash-1']);
    expect(mockPurge).toHaveBeenCalledWith(['trash-1']);
  });
});

describe('trashRouter member trash management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gives owners and admins per-member counts without the caller’s own row', async () => {
    for (const ctx of [owner, admin]) {
      const summary = await trashRouter.createCaller(ctx).memberSummary();
      expect(summary.every((row) => row.userId !== ctx.userId)).toBe(true);
      expect(summary.every((row) => Object.keys(row).sort().join() === 'total,userId')).toBe(true);
    }
    expect(await trashRouter.createCaller(owner).memberSummary()).toEqual([
      { total: 3, userId: 'member-1' },
    ]);
  });

  it('lets owners and admins empty another member’s bin in the active workspace', async () => {
    const result = await trashRouter
      .createCaller(admin)
      .emptyMemberTrash({ memberId: 'member-1', workspaceId: 'ws-1' });

    expect(result).toEqual({ hasMore: false, purged: 3 });
    expect(mockEmptyMemberTrash).toHaveBeenCalledWith('member-1');
  });

  it('refuses members, personal mode, a stale workspace and the caller’s own bin', async () => {
    await expect(trashRouter.createCaller(member).memberSummary()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(trashRouter.createCaller(personal).memberSummary()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      trashRouter
        .createCaller(member)
        .emptyMemberTrash({ memberId: 'owner-1', workspaceId: 'ws-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      trashRouter
        .createCaller(owner)
        .emptyMemberTrash({ memberId: 'member-1', workspaceId: 'ws-2' }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    await expect(
      trashRouter
        .createCaller(owner)
        .emptyMemberTrash({ memberId: 'owner-1', workspaceId: 'ws-1' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mockEmptyMemberTrash).not.toHaveBeenCalled();
  });
});
