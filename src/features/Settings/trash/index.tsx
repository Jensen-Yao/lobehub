'use client';

import { TRASH_RETENTION_DAYS } from '@lobechat/const';
import { Flexbox, Text } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';

import SettingHeader from '@/features/Settings/features/SettingHeader';

import MemberTrash from './features/MemberTrash';
import TrashList from './features/TrashList';

interface PageProps {
  /** Workspace bin: everyone sees only their own deletions; managers also get per-member counts. */
  isWorkspace?: boolean;
  showSettingHeader?: boolean;
}

const Page = ({ isWorkspace, showSettingHeader = true }: PageProps) => {
  const { t } = useTranslation('setting');

  return (
    <>
      {showSettingHeader && <SettingHeader title={t('tab.trash')} />}
      <Flexbox gap={12}>
        <Text type={'secondary'}>
          {t(isWorkspace ? 'trash.workspaceDesc' : 'trash.desc', { days: TRASH_RETENTION_DAYS })}
        </Text>
        <TrashList />
        {isWorkspace && <MemberTrash />}
      </Flexbox>
    </>
  );
};

Page.displayName = 'TrashSettings';

export default Page;
