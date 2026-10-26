import type { ChannelViewParams } from '@/services/channel';

import { channelViewKey } from './projection';
import type { ChannelState } from './store';

export const channelSelectors = {
  detail: (params: ChannelViewParams) => (state: ChannelState) =>
    state.detailMap[channelViewKey(params)],
  /** Receipt and reply progress must stay live even without gateway notifications. */
  hasPendingWork: (params: ChannelViewParams | null) => (state: ChannelState) => {
    const detail = params ? state.detailMap[channelViewKey(params)] : undefined;
    if (!detail) return false;
    return (
      detail.messages.some((message) => message.routingStatus === 'pending') ||
      detail.jobs.some(
        (job) =>
          (job.threadId ?? null) === (params?.threadId ?? null) &&
          (job.writerHeld ||
            (!job.publicationRevoked && (job.status === 'queued' || job.status === 'running'))),
      )
    );
  },
  list: (state: ChannelState) => state.listMap.all,
};
