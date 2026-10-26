// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(function () {
    return {};
  }),
}));

vi.mock('@/business/server/trpc-middlewares/rbacPermission', () => ({
  withScopedPermission: vi.fn(function () {
    return (opts: any) => opts.next({ ctx: opts.ctx });
  }),
}));

vi.mock('@/business/server/trpc-middlewares/workspaceAuth', async (importOriginal) => {
  const { authedProcedure } = await import('@/libs/trpc/lambda');
  return { ...(await importOriginal<object>()), wsCompatProcedure: authedProcedure };
});

vi.mock('@/server/services/goal', () => ({ GoalService: vi.fn() }));
vi.mock('@/server/services/goal/subscriptions', () => ({ GoalSubscriptionService: vi.fn() }));
vi.mock('@/database/models/goal', () => ({ GoalModel: vi.fn() }));

const mockHasPermission = vi.fn();
vi.mock('@/server/services/workspacePermission', () => ({
  hasWorkspaceScopedPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

const mockCopy = vi.fn();
const copyScopes: Array<string | undefined> = [];
vi.mock('@/server/services/goal/copy', () => ({
  GoalCopyService: vi.fn(function (_db: unknown, _userId: string, workspaceId?: string) {
    copyScopes.push(workspaceId);
    return { copyToWorkspace: mockCopy };
  }),
}));

const { transferRouter } = await import('./transfer');

describe('goal transferRouter.copyGoalToWorkspace', () => {
  const caller = (workspaceId: string | null) =>
    transferRouter.createCaller({ serverDB: {}, userId: 'user-1', workspaceId } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    copyScopes.length = 0;
    mockCopy.mockResolvedValue({ goalId: 'goal_copy' });
  });

  it('copies from the current scope once the target workspace grants write access', async () => {
    mockHasPermission.mockResolvedValue(true);

    const result = await caller('ws-source').copyGoalToWorkspace({
      id: 'goal_1',
      targetWorkspaceId: 'ws-target',
    });

    expect(mockHasPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AGENT_UPDATE',
        userId: 'user-1',
        workspaceId: 'ws-target',
      }),
    );
    expect(copyScopes).toEqual(['ws-source']);
    expect(mockCopy).toHaveBeenCalledWith('goal_1', 'ws-target');
    expect(result).toEqual({ goalId: 'goal_copy' });
  });

  it('refuses a target workspace the caller cannot write to', async () => {
    mockHasPermission.mockResolvedValue(false);

    await expect(
      caller(null).copyGoalToWorkspace({ id: 'goal_1', targetWorkspaceId: 'ws-target' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it('copies into personal without a workspace permission check', async () => {
    await caller('ws-source').copyGoalToWorkspace({ id: 'goal_1', targetWorkspaceId: null });

    expect(mockHasPermission).not.toHaveBeenCalled();
    expect(mockCopy).toHaveBeenCalledWith('goal_1', null);
  });
});
