import { beforeEach, describe, expect, it, vi } from 'vitest';

import { channelActions } from './action';

vi.mock('@/services/channel', () => ({
  channelService: {
    addAgent: vi.fn(),
    create: vi.fn(),
    detail: vi.fn(),
    list: vi.fn(),
    send: vi.fn(),
  },
}));

const { channelService } = await import('@/services/channel');

describe('channelActions after a committed write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    channelActions.reset();
  });

  // A refresh failure read as a create failure, so the retry created a second Channel.
  it('reports a created Channel even when the list refresh fails', async () => {
    vi.mocked(channelService.create).mockResolvedValue({
      data: { channel: { id: 'chn_000000000001' } },
    } as never);
    vi.mocked(channelService.list).mockRejectedValue(new Error('offline'));

    await expect(channelActions.create({ agents: [], title: 'Team' })).resolves.toBe(
      'chn_000000000001',
    );
    expect(channelService.create).toHaveBeenCalledTimes(1);
  });

  it('settles added members even when the detail refresh fails', async () => {
    vi.mocked(channelService.addAgent).mockResolvedValue({} as never);
    vi.mocked(channelService.detail).mockRejectedValue(new Error('offline'));

    await expect(
      channelActions.addAgents('chn_000000000001', [{ agentId: 'agt_a' }, { agentId: 'agt_b' }]),
    ).resolves.toBeUndefined();
  });

  it('still reports a failed add', async () => {
    vi.mocked(channelService.addAgent)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('device offline'));
    vi.mocked(channelService.detail).mockRejectedValue(new Error('offline'));

    await expect(
      channelActions.addAgents('chn_000000000001', [{ agentId: 'agt_a' }, { agentId: 'agt_b' }]),
    ).rejects.toThrow('device offline');
  });
});
