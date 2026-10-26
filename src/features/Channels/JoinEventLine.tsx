import { Flexbox } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

import type { ChannelJoinEvent } from './joinEvents';
import { MemberAvatar } from './MemberAvatar';
import { isCurrentUserMember, memberName } from './memberName';
import { styles } from './styles';

const MAX_AVATARS = 5;

/** “You invited A, B and C to the channel”, as a system line in the timeline. */
export function JoinEventLine({ event: { inviter, members } }: { event: ChannelJoinEvent }) {
  const { t, i18n } = useTranslation('channel');
  const userId = useUserStore(userProfileSelectors.userId);
  const names = new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
    members.map((member) => memberName(member, t('deletedMember'))),
  );
  const text = !inviter
    ? t('events.joined', { names })
    : isCurrentUserMember(inviter, userId)
      ? t('events.youInvited', { names })
      : t('events.invited', { inviter: memberName(inviter, t('deletedMember')), names });
  return (
    <div role="note" {...stylex.props(styles.event)}>
      <Flexbox horizontal flex="none" gap={2}>
        {members.slice(0, MAX_AVATARS).map((member) => (
          <MemberAvatar key={member.id} member={member} size={18} />
        ))}
      </Flexbox>
      <span>{text}</span>
    </div>
  );
}
