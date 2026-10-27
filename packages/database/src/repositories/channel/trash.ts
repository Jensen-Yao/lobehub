import { and, eq } from 'drizzle-orm';

import { TrashModel } from '../../models/trash';
import { channelJobs, channels } from '../../schemas';
import type { LobeChatDatabase, Transaction } from '../../type';
import { isTrashed, restoreStamp } from '../../utils/softDelete';
import { buildWorkspaceWhere } from '../../utils/workspace';
import { audit } from './transaction';

/** Recycle-bin lifecycle; the trash router authorizes the registry row before calling. */
export class ChannelTrashRepository {
  constructor(
    private readonly db: LobeChatDatabase,
    private readonly userId: string,
    private readonly workspaceId?: string,
  ) {}

  private lockTrashed = async (tx: Transaction, id: string) => {
    const [channel] = await tx
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.id, id),
          isTrashed(channels.isDeleted),
          buildWorkspaceWhere(
            { includeTrashed: true, userId: this.userId, workspaceId: this.workspaceId },
            channels,
          ),
        ),
      )
      .for('update');
    return channel;
  };

  private unregister = (tx: Transaction, id: string) =>
    new TrashModel(this.db, this.userId, this.workspaceId).removeByResources(
      [{ resourceId: id, resourceType: 'channel' }],
      tx,
    );

  /** Restore access only. Archived branches and cancelled jobs retain their own state. */
  restore = async (id: string): Promise<boolean> =>
    this.db.transaction(async (tx) => {
      if (!(await this.lockTrashed(tx, id))) return false;
      await tx.update(channels).set(restoreStamp()).where(eq(channels.id, id));
      await audit(tx, id, 'restored', id);
      await this.unregister(tx, id);
      return true;
    });

  /**
   * Never erase a live writer's physical lock, even when its channel is in the bin: a channel
   * whose replies are still stopping reports `busy` and stays in the bin for a later purge.
   */
  purge = async (id: string): Promise<'busy' | 'missing' | 'purged'> =>
    this.db.transaction(async (tx) => {
      if (!(await this.lockTrashed(tx, id))) return 'missing';
      const [writer] = await tx
        .select({ id: channelJobs.id })
        .from(channelJobs)
        .where(and(eq(channelJobs.channelId, id), eq(channelJobs.writerHeld, true)))
        .limit(1);
      if (writer) return 'busy';
      // Only Channel-owned records cascade; the referenced Agents, files and topics remain.
      await tx.delete(channels).where(eq(channels.id, id));
      await this.unregister(tx, id);
      return 'purged';
    });
}
