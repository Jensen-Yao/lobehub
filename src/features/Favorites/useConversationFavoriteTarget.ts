import { useTranslation } from 'react-i18next';

import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';

import { type FavoriteTarget } from './useFavoriteToggle';

export interface ConversationFavoriteOwner {
  avatar?: string | null;
  id: string;
  /** Whether the owner's meta has loaded; the star waits for it. */
  loaded: boolean;
  path: string;
  title?: string;
  type: 'agent' | 'group';
  /** Shown while the owner has no title of its own. */
  untitledTitle: string;
}

interface ConversationFavoriteParams {
  owner?: ConversationFavoriteOwner;
  topicId?: string | null;
  topicPath?: string;
}

/**
 * What a conversation header's star favorites: the open topic, or the agent or
 * group itself before its first topic. Agent and group headers share this so
 * the placeholder titles and snapshot readiness stay the same for both.
 */
export const useConversationFavoriteTarget = ({
  owner,
  topicId,
  topicPath,
}: ConversationFavoriteParams): FavoriteTarget | undefined => {
  const { t } = useTranslation('topic');
  const topicTitle = useChatStore((s) =>
    topicId ? topicSelectors.getTopicById(topicId)(s)?.title : undefined,
  );

  if (!owner) return;

  if (topicId && topicPath)
    return {
      path: topicPath,
      snapshotReady: topicTitle !== undefined,
      targetId: topicId,
      title: topicTitle || t('newTopic'),
      type: 'topic',
    };

  return {
    icon: owner.avatar ?? null,
    path: owner.path,
    snapshotReady: owner.loaded,
    targetId: owner.id,
    title: owner.title || owner.untitledTitle,
    type: owner.type,
  };
};
