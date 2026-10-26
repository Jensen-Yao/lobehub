import { cacheScope } from '@/libs/replica';
import { useClientDataSWR } from '@/libs/swr';
import { channelKeys } from '@/libs/swr/keys';
import {
  type ChannelAgentSelection,
  channelService,
  type ChannelViewParams,
} from '@/services/channel';

import { ChannelPrivateAction } from './privateAction';
import { channelThreadEntityId } from './projection';
import { channelSelectors } from './selectors';
import { initialState, useChannelStore } from './store';

class ChannelActionImpl {
  readonly #private = new ChannelPrivateAction(useChannelStore.setState, useChannelStore.getState);
  useFetchUserCandidates = (channelId: string, search: string) =>
    useClientDataSWR(channelKeys.userCandidates(channelId, search), () =>
      channelService.userCandidates(channelId, search),
    );
  addUser = async (channelId: string, userId: string) => {
    await channelService.addUser(channelId, userId);
    await this.refreshDetail({ channelId });
  };
  useFetchList = () => this.#private.list.useSync({}, { refreshInterval: 30_000 });
  useFetchDetail = (params: ChannelViewParams | null) => {
    // Subscribe to the replica, not just SWR's last response: sending a message
    // updates this view imperatively and must shorten an already scheduled idle poll.
    const pending = useChannelStore(channelSelectors.hasPendingWork(params));
    return this.#private.detail.useSync(params, { refreshInterval: pending ? 1000 : 30_000 });
  };
  refreshList = () => this.#private.list.fetch({}, { fresh: true });
  refreshDetail = (params: ChannelViewParams) =>
    this.#private.detail.fetch(params, { fresh: true });
  /**
   * Refresh after a write that already committed. A failed refresh must not read as a failed
   * write, or retrying repeats it; the periodic sync catches up instead.
   */
  #refreshAfterWrite = async (refresh: () => Promise<unknown>) => {
    try {
      await refresh();
    } catch (error) {
      console.error('Failed to refresh Channels after a write', error);
    }
  };
  create = async (input: Parameters<typeof channelService.create>[0]) => {
    const result = await channelService.create(input);
    await this.#refreshAfterWrite(this.refreshList);
    return result.data.channel.id;
  };
  remove = async (channelId: string) => {
    const scope = cacheScope.get();
    // Optimistically hide the row; failure restores it. Keep the open conversation
    // until success, then purge every thread/page (including persisted copies).
    await this.#private.list.optimistic(
      'all',
      (items) => items?.filter((channel) => channel.id !== channelId),
      () => channelService.remove(channelId),
    );
    this.#private.entity.remove(channelId, { scope });
  };
  removeThread = async (channelId: string, threadId: string) => {
    const scope = cacheScope.get();
    // Optimistically hide sidebar references, retaining the open view until confirmed.
    const tokens = this.#private.detail.beginEntityOptimistic(
      channelThreadEntityId(channelId, threadId),
      () => undefined,
    );
    try {
      await channelService.removeThread(channelId, threadId);
      for (const token of tokens) token.commit();
      this.#private.removeThread(channelId, threadId, scope);
    } catch (error) {
      for (const token of tokens) token.rollback();
      throw error;
    }
  };
  /** Members join one at a time: each add takes the Channel row lock. */
  addAgents = async (channelId: string, agents: ChannelAgentSelection[]) => {
    try {
      for (const agent of agents) await channelService.addAgent(channelId, agent);
    } finally {
      // A partial failure still shows the members that did join.
      await this.#refreshAfterWrite(() => this.refreshDetail({ channelId }));
    }
  };
  send = async (input: Parameters<typeof channelService.send>[0]) => {
    const scope = cacheScope.get();
    const { data } = await channelService.send(input);
    if (cacheScope.get() !== scope) return data;
    await this.#refreshAfterWrite(() =>
      Promise.all([
        this.refreshDetail({ channelId: input.channelId, threadId: data.threadId }),
        ...(input.rootMessageId ? [this.refreshDetail({ channelId: input.channelId })] : []),
        this.refreshList(),
      ]),
    );
    return data;
  };
  stop = async (channelId: string, scope: Parameters<typeof channelService.stop>[1]) => {
    await channelService.stop(channelId, scope);
    await this.refreshDetail({ channelId, threadId: 'threadId' in scope ? scope.threadId : null });
  };
  reset = () => {
    this.#private.resetThreadRemovals();
    useChannelStore.setState(initialState, false, 'channel/reset');
  };
}

export const channelActions = new ChannelActionImpl();
