import type { ChannelDetail, ChannelPublicJob, ChannelPublicMessage } from '@lobechat/types';
import { Avatar, Button, Flexbox, Popover, Text, usePopoverContext } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import { ExternalLink, Square } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { channelActions } from '@/store/channel';

import { ChannelStatus } from './ChannelStatus';
import {
  channelJobStatus,
  channelJobTone,
  isChannelJobActive,
  messageReceiptJobs,
} from './jobStatus';
import { memberAvatar, memberName } from './memberName';
import { statusStyles, styles } from './styles';

function ReceiptDetail({
  agentId,
  channelId,
  job,
  name,
  avatar,
}: {
  agentId?: string | null;
  avatar: string;
  channelId: string;
  job: ChannelPublicJob;
  name: string;
}) {
  const { t } = useTranslation('channel');
  const navigate = useWorkspaceAwareNavigate();
  const { close } = usePopoverContext();
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<unknown>();
  const stop = async () => {
    setStopping(true);
    setError(undefined);
    try {
      await channelActions.stop(channelId, { jobId: job.id });
    } catch (cause) {
      console.error('Failed to stop Channel reply', cause);
      setError(cause);
    } finally {
      setStopping(false);
    }
  };
  return (
    <Flexbox gap={12} {...stylex.props(statusStyles.popover)}>
      <Flexbox horizontal align="center" gap={8}>
        <Avatar avatar={avatar} size={28} title={name} />
        <Text ellipsis weight={500}>
          {name}
        </Text>
      </Flexbox>
      <ChannelStatus label={t(channelJobStatus(job))} tone={channelJobTone(job)} />
      {job.status === 'failed' && (
        <Flexbox gap={4}>
          <Text weight={500}>{t('receipt.errorReason')}</Text>
          <Text style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
            {job.errorMessage?.trim() || t('receipt.errorUnavailable')}
          </Text>
          <span {...stylex.props(styles.muted)}>{t('receipt.failedHint')}</span>
        </Flexbox>
      )}
      <Flexbox horizontal gap={4} wrap="wrap">
        {isChannelJobActive(job) && (
          <Button
            danger
            icon={Square}
            loading={stopping}
            size="small"
            type="text"
            onClick={() => void stop()}
          >
            {t('stopReply')}
          </Button>
        )}
        {agentId && (
          <Button
            icon={ExternalLink}
            size="small"
            type="text"
            onClick={() => {
              close();
              navigate(`/agent/${agentId}`);
            }}
          >
            {t('openAgent')}
          </Button>
        )}
      </Flexbox>
      {error !== undefined && <AsyncError error={error} variant="inline" />}
    </Flexbox>
  );
}

/** Ongoing replies and failures only; published replies are already visible in the timeline. */
export function MessageReceipts({
  detail,
  message,
}: {
  detail: ChannelDetail;
  message: ChannelPublicMessage;
}) {
  const { t } = useTranslation('channel');
  const { channel, jobs: allJobs = [], members = [] } = detail;
  const jobs = allJobs.filter((job) => job.messageId === message.id);
  if (!channel) return null;
  if (!jobs.length)
    return message.routingStatus === 'pending' || message.routingStatus === 'unassigned' ? (
      <span role="status" {...stylex.props(statusStyles.receipts, styles.muted)}>
        {t(message.routingStatus === 'pending' ? 'routing.receiving' : 'routing.unassigned')}
      </span>
    ) : null;

  const receipts = messageReceiptJobs(jobs).map((job) => {
    const member = members.find((entry) => entry.id === job.memberId);
    return {
      agentId: member?.agentId,
      avatar: memberAvatar(member),
      job,
      name: memberName(member, t('unnamedAgent')),
    };
  });
  if (!receipts.length) return null;

  return (
    <Flexbox align="flex-start" gap={4} {...stylex.props(statusStyles.receipts)}>
      <Flexbox horizontal align="center" gap={4} role="status" wrap="wrap">
        {receipts.map(({ agentId, avatar, job, name }) => (
          <Popover
            key={job.id}
            placement="bottomLeft"
            trigger="click"
            content={
              <ReceiptDetail
                agentId={agentId}
                avatar={avatar}
                channelId={channel.id}
                job={job}
                name={name}
              />
            }
          >
            <Button
              aria-label={t('receipt.memberLabel', { name, state: t(channelJobStatus(job)) })}
              size="small"
              type="text"
              {...stylex.props(statusStyles.chip)}
            >
              <Avatar avatar={avatar} size={18} title={name} />
              <span {...stylex.props(statusStyles.name)}>{name}</span>
              <ChannelStatus label={t(channelJobStatus(job))} tone={channelJobTone(job)} />
            </Button>
          </Popover>
        ))}
      </Flexbox>
    </Flexbox>
  );
}
