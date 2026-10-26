import type { ChannelDetail, ChannelPublicMessage } from '@lobechat/types';
import { ActionIcon, Button, Divider, Flexbox, Icon } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import { GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import CollapsibleContent from '@/components/CollapsibleContent';
import { ChatItem } from '@/features/Conversation/ChatItem';
import Markdown from '@/features/Conversation/Markdown';
import UserAvatar from '@/features/User/UserAvatar';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import { authorAvatar, isCurrentUserAuthor } from './memberName';
import { MessageAttachments } from './MessageAttachments';
import { MessageReceipts } from './MessageReceipts';
import { styles } from './styles';
import type { ChannelThreadDraft } from './threadDraft';

export const ChannelMessage = ({
  detail,
  message,
  isRoot,
  threadId,
  onOpenThread,
  onStartThread,
}: {
  detail: ChannelDetail;
  isRoot?: boolean;
  message: ChannelPublicMessage;
  onOpenThread?: (threadId: string) => void;
  onStartThread?: (draft: ChannelThreadDraft) => void;
  threadId?: string | null;
}) => {
  const { t } = useTranslation('channel');
  const isOwnMessage = useUserStore((s) =>
    isCurrentUserAuthor(message.author, userProfileSelectors.userId(s)),
  );
  // Inside a thread, its root and replies link nowhere else.
  const thread =
    !threadId && !isRoot && detail.threads.find((entry) => entry.rootMessageId === message.id);
  const canBranch = !threadId && !isRoot && !thread && !detail.channel.archived && !!onStartThread;
  return (
    <div data-message-id={message.id} {...stylex.props(styles.messageRow, stylex.defaultMarker())}>
      <ChatItem
        showAvatar
        showTitle
        avatarProps={{ size: 36 }}
        gap={4}
        id={message.id}
        paddingBlock={12}
        placement="left"
        style={{ paddingInlineStart: 48 }}
        time={new Date(message.createdAt).getTime()}
        actionAddon={
          thread ? (
            <Button
              icon={GitBranch}
              size="small"
              type="text"
              onClick={() => onOpenThread?.(thread.id)}
            >
              {t('openThread')}
            </Button>
          ) : undefined
        }
        avatar={{
          avatar: authorAvatar(message.author),
          title: message.author.name || t('deletedMember'),
        }}
        belowMessage={
          message.author.type === 'user' && !isRoot ? (
            <MessageReceipts detail={detail} message={message} />
          ) : undefined
        }
        customAvatarRender={(_, avatar) => (
          <Flexbox {...stylex.props(styles.messageAvatar)}>
            {isOwnMessage ? <UserAvatar size={36} /> : avatar}
          </Flexbox>
        )}
        message={
          <CollapsibleContent key={message.id}>
            <Flexbox gap={8}>
              {message.fileIds.length > 0 && (
                <MessageAttachments attachments={detail.attachments} fileIds={message.fileIds} />
              )}
              {message.content && <Markdown>{message.content}</Markdown>}
            </Flexbox>
          </CollapsibleContent>
        }
      />
      {canBranch && (
        <ActionIcon
          aria-label={t('startThread')}
          icon={GitBranch}
          size="small"
          title={t('startThread')}
          onClick={() =>
            onStartThread?.({
              root: message,
              attachments: detail.attachments.filter((file) => message.fileIds.includes(file.id)),
            })
          }
          {...stylex.props(styles.branchAction)}
        />
      )}
    </div>
  );
};

export function ThreadRootMessage({
  detail,
  root,
}: {
  detail: ChannelDetail;
  root: ChannelPublicMessage;
}) {
  const { t } = useTranslation('channel');
  return (
    <Flexbox>
      <ChannelMessage isRoot detail={detail} message={root} />
      <Divider>
        <Flexbox horizontal align="center" gap={6} {...stylex.props(styles.muted)}>
          <Icon icon={GitBranch} size={12} />
          {t('threadDivider')}
        </Flexbox>
      </Divider>
    </Flexbox>
  );
}
