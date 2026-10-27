'use client';

import { AGENT_CHAT_TOPIC_URL, AGENT_CHAT_URL } from '@lobechat/const';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAgentContext } from '@/features/Conversation/useAgentContext';
import { FavoriteButton, useConversationFavoriteTarget } from '@/features/Favorites';
import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';

/**
 * Favorites the open topic, or the agent itself on its new-topic screen. Only
 * the sidebar Favorites are touched; the topic's own favorite flag (the topic
 * list's star filter) is a separate setting in the ⋯ menu.
 */
const FavoriteToggle = memo(() => {
  const { t } = useTranslation('chat');
  const { agentId, topicId } = useAgentContext();
  const agentMeta = useAgentStore((s) =>
    agentId ? agentSelectors.getAgentMetaById(agentId)(s) : undefined,
  );

  const target = useConversationFavoriteTarget({
    owner: agentId
      ? {
          avatar: agentMeta?.avatar,
          id: agentId,
          path: AGENT_CHAT_URL(agentId),
          title: agentMeta?.title,
          type: 'agent',
          untitledTitle: t('untitledAgent'),
        }
      : undefined,
    topicId,
    topicPath: agentId && topicId ? AGENT_CHAT_TOPIC_URL(agentId, topicId) : undefined,
  });

  if (!target) return null;

  return <FavoriteButton {...target} />;
});

FavoriteToggle.displayName = 'FavoriteToggle';

export default FavoriteToggle;
