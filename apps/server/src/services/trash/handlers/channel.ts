import { ChannelTrashRepository } from '@/database/repositories/channel/trash';

import { type TrashHandler, TrashRestoreError } from './types';

export const channelHandler: TrashHandler = {
  purge: async (ctx, root) => {
    await new ChannelTrashRepository(ctx.db, root.userId, root.workspaceId ?? undefined).purge(
      root.resourceId,
    );
  },
  restore: async (ctx, root) => {
    const restored = await new ChannelTrashRepository(
      ctx.db,
      root.userId,
      root.workspaceId ?? undefined,
    ).restore(root.resourceId);
    if (!restored) throw new TrashRestoreError('notFound');
  },
  type: 'channel',
};
