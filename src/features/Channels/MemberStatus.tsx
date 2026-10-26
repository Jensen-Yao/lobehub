import type { ChannelDetail, ChannelPublicMember } from '@lobechat/types';
import { ActionIcon, Avatar, Button, Flexbox, Popover, Text } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import { ExternalLink, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useCloseOnNavigate } from '@/hooks/useCloseOnNavigate';

import { ChannelStatus } from './ChannelStatus';
import { openCreateChannel } from './CreateChannel';
import type { ChannelStatusTone } from './jobStatus';
import { channelJobStatus, channelJobTone, memberCurrentJob } from './jobStatus';
import { memberAvatar, memberName } from './memberName';
import { statusStyles, styles, toneStyles } from './styles';

/** Header avatars before the rest fold into a count; the list shows everyone. */
const MAX_VISIBLE = 5;

interface MemberEntry {
  avatar: string;
  label: string;
  member: ChannelPublicMember;
  name: string;
  tone: ChannelStatusTone;
}

const MemberAvatar = ({ entry, size }: { entry: MemberEntry; size: number }) => (
  <span {...stylex.props(statusStyles.memberAvatar)}>
    <Avatar avatar={entry.avatar} size={size} title={entry.name} />
    {entry.member.actorType === 'agent' && (
      <span
        aria-hidden
        {...stylex.props(statusStyles.state, statusStyles.memberDot, toneStyles[entry.tone])}
      >
        <span {...stylex.props(statusStyles.dot)} />
      </span>
    )}
  </span>
);

/**
 * Members as avatars with live status dots. One click lists everyone by name, because
 * Agents often share the default avatar and a long roster would not fit the header.
 */
export function MemberStatus({ detail }: { detail: ChannelDetail }) {
  const { t } = useTranslation('channel');
  const navigate = useWorkspaceAwareNavigate();
  const [open, setOpen] = useState(false);
  const popoverKey = useCloseOnNavigate(open, () => setOpen(false));
  const { channel, jobs = [], members: allMembers = [] } = detail;
  const entries: MemberEntry[] = allMembers
    .filter((member) => member.active)
    .map((member) => {
      const job = member.actorType === 'agent' ? memberCurrentJob(jobs, member.id) : undefined;
      return {
        avatar: memberAvatar(member),
        label: member.actorType === 'agent' ? t(job ? channelJobStatus(job) : 'status.idle') : '',
        member,
        name: memberName(member, t('deletedMember')),
        tone: job ? channelJobTone(job) : 'quiet',
      };
    });
  const overflow = entries.length - MAX_VISIBLE;
  const title = t('membersCount', { count: entries.length });

  return (
    <Flexbox horizontal align="center" gap={4}>
      <Popover
        key={popoverKey}
        open={open}
        placement="bottomRight"
        trigger="click"
        content={
          <Flexbox gap={4} {...stylex.props(statusStyles.popover, statusStyles.memberList)}>
            <Text fontSize={12} type="secondary" weight={500}>
              {title}
            </Text>
            {entries.map((entry) => (
              <Flexbox horizontal align="center" gap={8} key={entry.member.id} paddingBlock={6}>
                <MemberAvatar entry={entry} size={28} />
                <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
                  <Text ellipsis weight={500}>
                    {entry.name}
                  </Text>
                  {entry.member.actorType === 'agent' ? (
                    <ChannelStatus label={entry.label} tone={entry.tone} />
                  ) : (
                    <span {...stylex.props(styles.muted)}>{t('person')}</span>
                  )}
                </Flexbox>
                {entry.member.agentId && (
                  <ActionIcon
                    aria-label={t('openAgentNamed', { name: entry.name })}
                    icon={ExternalLink}
                    size="small"
                    title={t('openAgent')}
                    onClick={() => navigate(`/agent/${entry.member.agentId}`)}
                  />
                )}
              </Flexbox>
            ))}
          </Flexbox>
        }
        onOpenChange={setOpen}
      >
        <Button
          aria-label={title}
          size="small"
          type="text"
          {...stylex.props(statusStyles.memberButton)}
        >
          {entries.slice(0, MAX_VISIBLE).map((entry) => (
            <MemberAvatar entry={entry} key={entry.member.id} size={24} />
          ))}
          {overflow > 0 && <span {...stylex.props(styles.muted)}>+{overflow}</span>}
        </Button>
      </Popover>
      {channel && !channel.archived && (
        <ActionIcon
          aria-label={t('addMembers')}
          icon={Plus}
          size="small"
          title={t('addMembers')}
          onClick={() =>
            openCreateChannel({
              existing: {
                agentIds: entries.flatMap(({ member }) => (member.agentId ? [member.agentId] : [])),
                id: channel.id,
                title: channel.title,
              },
            })
          }
        />
      )}
    </Flexbox>
  );
}
