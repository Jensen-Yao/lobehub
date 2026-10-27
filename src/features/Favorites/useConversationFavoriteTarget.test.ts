/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ConversationFavoriteOwner,
  useConversationFavoriteTarget,
} from './useConversationFavoriteTarget';

const topics = vi.hoisted(() => ({ titles: {} as Record<string, string | undefined> }));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/store/chat/selectors', () => ({
  topicSelectors: {
    getTopicById: (id: string) => () =>
      id in topics.titles ? { id, title: topics.titles[id] } : undefined,
  },
}));
vi.mock('@/store/chat', () => ({
  useChatStore: (selector: (s: unknown) => unknown) => selector({}),
}));

const group: ConversationFavoriteOwner = {
  avatar: '🧩',
  id: 'grp_1',
  path: '/group/grp_1',
  title: 'Design Crew',
  type: 'group',
  untitledTitle: 'untitledGroup',
};

describe('useConversationFavoriteTarget', () => {
  beforeEach(() => {
    topics.titles = {};
  });

  it('favorites the owner itself before its first topic', () => {
    const { result } = renderHook(() => useConversationFavoriteTarget({ owner: group }));

    expect(result.current).toEqual({
      icon: '🧩',
      path: '/group/grp_1',
      snapshotReady: true,
      targetId: 'grp_1',
      title: 'Design Crew',
      type: 'group',
    });
  });

  it('waits for an untitled owner and shows its placeholder', () => {
    const { result } = renderHook(() =>
      useConversationFavoriteTarget({ owner: { ...group, avatar: undefined, title: undefined } }),
    );

    expect(result.current).toMatchObject({
      icon: null,
      snapshotReady: false,
      title: 'untitledGroup',
    });
  });

  it('favorites the open topic under its own link', () => {
    topics.titles = { tpc_1: 'Launch plan' };
    const { result } = renderHook(() =>
      useConversationFavoriteTarget({
        owner: group,
        topicId: 'tpc_1',
        topicPath: '/group/grp_1?topic=tpc_1',
      }),
    );

    expect(result.current).toEqual({
      path: '/group/grp_1?topic=tpc_1',
      snapshotReady: true,
      targetId: 'tpc_1',
      title: 'Launch plan',
      type: 'topic',
    });
  });

  it('holds the snapshot until the topic is loaded', () => {
    const { result } = renderHook(() =>
      useConversationFavoriteTarget({
        owner: group,
        topicId: 'tpc_2',
        topicPath: '/group/grp_1?topic=tpc_2',
      }),
    );

    expect(result.current).toMatchObject({ snapshotReady: false, title: 'newTopic' });
  });

  it('has nothing to favorite without an owner', () => {
    const { result } = renderHook(() => useConversationFavoriteTarget({ topicId: 'tpc_1' }));

    expect(result.current).toBeUndefined();
  });
});
