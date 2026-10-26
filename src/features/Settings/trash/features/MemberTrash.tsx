'use client';

import { Avatar, Button, confirmModal, Flexbox, Text, toast } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import { useTranslation } from 'react-i18next';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { useAuthorInfo } from '@/business/client/hooks/useAuthorInfo';
import { usePermission } from '@/hooks/usePermission';
import { useClientDataSWR } from '@/libs/swr';
import { trashService } from '@/services/trash';

const styles = stylex.create({
  container: {
    backgroundColor: cssVar.colorBgContainer,
    borderRadius: cssVar.borderRadius,
    overflow: 'hidden',
  },
  divided: {
    borderBlockStartColor: cssVar.colorBorderSecondary,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
  },
  row: {
    paddingBlock: 12,
    paddingInline: 24,
  },
});

interface MemberRowProps {
  divided: boolean;
  onEmpty: (memberId: string, name: string, total: number) => void;
  total: number;
  userId: string;
}

const MemberRow = ({ divided, onEmpty, total, userId }: MemberRowProps) => {
  const { t } = useTranslation('setting');
  const author = useAuthorInfo(userId);
  const name = author?.fullName || t('trash.members.unknown');

  return (
    <Flexbox
      horizontal
      align={'center'}
      gap={12}
      {...stylex.props(styles.row, divided && styles.divided)}
    >
      <Avatar avatar={author?.avatar || name} size={24} style={{ flexShrink: 0 }} title={name} />
      <Flexbox flex={1} style={{ minWidth: 0 }}>
        <Text ellipsis={{ tooltip: name, tooltipWhenOverflow: true }}>{name}</Text>
      </Flexbox>
      <Text type={'secondary'}>{t('trash.members.count', { count: total })}</Text>
      <Button danger size={'small'} onClick={() => onEmpty(userId, name, total)}>
        {t('trash.members.empty')}
      </Button>
    </Flexbox>
  );
};

/**
 * Other members' bins as a workspace owner or admin may see them: how many
 * items each holds, and a way to empty one for good. Titles, types and
 * restore stay with the member — their deletions can be private agents and
 * topics. Renders nothing for anyone the server does not let manage them.
 */
const MemberTrash = () => {
  const { t } = useTranslation('setting');
  const { t: tc } = useTranslation('common');
  const workspaceId = useActiveWorkspaceId();
  const { allowed } = usePermission('manage_settings');
  const enabled = allowed && !!workspaceId;

  const { data, error, mutate } = useClientDataSWR(
    enabled ? ['trash.memberSummary', workspaceId] : null,
    () => trashService.memberSummary(),
  );

  if (!enabled || error || !data) return null;

  const handleEmpty = (memberId: string, name: string, total: number) => {
    confirmModal({
      cancelText: tc('cancel'),
      content: t('trash.members.emptyConfirm.content', { count: total, name }),
      okButtonProps: { danger: true },
      okText: t('trash.members.empty'),
      onOk: async () => {
        try {
          // The server empties one bounded batch per call; repeat until it is done.
          for (;;) {
            const { hasMore } = await trashService.emptyMemberTrash(memberId, workspaceId!);
            if (!hasMore) break;
          }
        } catch {
          toast.error(tc('operationFailed'));
          return;
        } finally {
          await mutate();
        }
        toast.success(t('trash.purge.success'));
      },
      title: t('trash.members.emptyConfirm.title'),
    });
  };

  return (
    <Flexbox gap={12} style={{ marginBlockStart: 24 }}>
      <Flexbox gap={4}>
        <Text strong>{t('trash.members.title')}</Text>
        <Text type={'secondary'}>{t('trash.members.desc')}</Text>
      </Flexbox>
      <Flexbox {...stylex.props(styles.container)}>
        {data.length === 0 ? (
          <Flexbox {...stylex.props(styles.row)}>
            <Text type={'secondary'}>{t('trash.members.none')}</Text>
          </Flexbox>
        ) : (
          data.map((row, index) => (
            <MemberRow divided={index > 0} key={row.userId} onEmpty={handleEmpty} {...row} />
          ))
        )}
      </Flexbox>
    </Flexbox>
  );
};

export default MemberTrash;
