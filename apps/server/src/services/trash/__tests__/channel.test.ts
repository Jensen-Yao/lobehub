// @vitest-environment node
import { getTestDB } from '@lobechat/database/test-utils';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TrashModel } from '@/database/models/trash';
import { ChannelExecutionRepository, ChannelRepository } from '@/database/repositories/channel';
import {
  createChannelFixture,
  jobsOf,
  lease,
} from '@/database/repositories/channel/__tests__/testUtils';
import { channels } from '@/database/schemas';

import { TrashService } from '../index';

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({ deleteFiles: vi.fn() })),
}));

const db = await getTestDB();
const fixture = createChannelFixture(db, 'channel-trash-service');
beforeEach(fixture.setup);
afterEach(fixture.cleanup);

describe('Channel trash handler', () => {
  it('lists, restores and purges the channel through the shared recycle bin', async () => {
    const repo = new ChannelRepository(db, fixture.ownerId);
    const service = new TrashService(db, fixture.ownerId);
    const { channel } = await repo.create({ title: 'Restore me' });
    await repo.remove(channel.id);
    const { items } = await service.list({ resourceType: 'channel' });
    expect(items).toHaveLength(1);
    expect(await service.restore([items[0].id])).toEqual({ failed: [], restored: items });
    expect(await repo.list()).toHaveLength(1);
    expect((await service.list()).items).toEqual([]);
    await repo.remove(channel.id);
    const trashed = await service.list();
    await service.purge(trashed.items.map((item) => item.id));
    expect(await db.select().from(channels).where(eq(channels.id, channel.id))).toEqual([]);
    expect((await service.list()).items).toEqual([]);
  });

  it('keeps a channel whose replies are still stopping and purges the rest', async () => {
    const repo = new ChannelRepository(db, fixture.ownerId);
    const service = new TrashService(db, fixture.ownerId);
    const { channel: busy } = await repo.create({ title: 'Still stopping' });
    const agent = await fixture.addAgent(busy.id, 'Writer');
    const message = await repo.send(busy.id, {
      content: 'Work',
      mentions: [agent.id],
      requestKey: 'run',
      routing: 'fallback',
    });
    const [job] = await jobsOf(db, message.id);
    await new ChannelExecutionRepository(db).claim(busy.id, job.id, lease);
    const { channel: idle } = await repo.create({ title: 'Idle' });
    await repo.remove(busy.id);
    await repo.remove(idle.id);
    const busyRoot = await new TrashModel(db, fixture.ownerId).findByResource('channel', busy.id);

    const { items } = await service.list({ resourceType: 'channel' });
    expect(await service.purge(items.map((item) => item.id))).toEqual({
      blocked: [busyRoot!.id],
      purged: 1,
    });
    expect((await service.list()).items.map((item) => item.resourceId)).toEqual([busy.id]);
    expect(await service.emptyTrash()).toEqual({ blocked: 1, hasMore: false, purged: 0 });
    expect(await db.select().from(channels).where(eq(channels.id, busy.id))).toHaveLength(1);
  });

  it('cannot restore or purge a registry row outside the current identity', async () => {
    const repo = new ChannelRepository(db, fixture.ownerId);
    const { channel } = await repo.create({ title: 'Private' });
    await repo.remove(channel.id);
    const root = await new TrashModel(db, fixture.ownerId).findByResource('channel', channel.id);
    const stranger = new TrashService(db, fixture.memberId);
    expect(await stranger.restore([root!.id])).toEqual({
      failed: [{ code: 'notFound', id: root!.id }],
      restored: [],
    });
    await stranger.purge([root!.id]);
    expect(await db.select().from(channels).where(eq(channels.id, channel.id))).toHaveLength(1);
  });
});
