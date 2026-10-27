'use client';

import { GROUP_CHAT_TOPIC_URL, GROUP_CHAT_URL } from '@lobechat/const';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { FavoriteButton, useConversationFavoriteTarget } from '@/features/Favorites';
import { useAgentGroupStore } from '@/store/agentGroup';
import { agentGroupSelectors } from '@/store/agentGroup/selectors';

import { useGroupContext } from '../../useGroupContext';

/** Favorites the open group topic, or the group itself before its first topic. */
const FavoriteToggle = memo(() => {
  const { t } = useTranslation('chat');
  const { groupId, topicId } = useGroupContext();
  const groupMeta = useAgentGroupStore((s) =>
    groupId ? agentGroupSelectors.getGroupMeta(groupId)(s) : undefined,
  );
  const groupLoaded = useAgentGroupStore((s) =>
    groupId ? !!agentGroupSelectors.getGroupById(groupId)(s) : false,
  );

  const target = useConversationFavoriteTarget({
    owner: groupId
      ? {
          avatar: groupMeta?.avatar,
          id: groupId,
          loaded: groupLoaded,
          path: GROUP_CHAT_URL(groupId),
          title: groupMeta?.title,
          type: 'group',
          untitledTitle: t('untitledGroup'),
        }
      : undefined,
    topicId,
    topicPath: groupId && topicId ? GROUP_CHAT_TOPIC_URL(groupId, topicId) : undefined,
  });

  if (!target) return null;

  return <FavoriteButton {...target} />;
});

FavoriteToggle.displayName = 'FavoriteToggle';

export default FavoriteToggle;
