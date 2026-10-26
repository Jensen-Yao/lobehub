import { agentDisplayName } from '@lobechat/types';
import { ActionIcon, Button, Flexbox, Select, Text } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import { FolderOpen, X } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import Avatar from '@/components/Avatar';
import { DEFAULT_AVATAR } from '@/const/meta';
import { openPickWorkingDirModal } from '@/features/WorkingDirectory';
import type { DeviceListResult } from '@/store/device/useDeviceList';

import type { ChannelAgentDraft } from './agentEnvironment';
import { useChannelAgentDraft } from './useChannelAgentDraft';
import type { ChannelAgentOption } from './useChannelAgentOptions';

const styles = stylex.create({
  extra: { paddingInlineStart: 44, paddingInlineEnd: 8, paddingBlockEnd: 12, minWidth: 0 },
  directory: { maxWidth: '100%', overflow: 'hidden' },
});

export const SelectedAgent = ({
  agent,
  devices,
  draft: input,
  setDrafts,
}: {
  agent?: ChannelAgentOption;
  devices: DeviceListResult;
  draft: ChannelAgentDraft;
  setDrafts: Dispatch<SetStateAction<ChannelAgentDraft[]>>;
}) => {
  const { t } = useTranslation(['channel', 'chat', 'common']);
  const { change, changeDevice, draft, requiresDevice, retry, sync } = useChannelAgentDraft(
    input,
    devices,
    setDrafts,
  );
  const name = agentDisplayName(agent, t('unnamedAgent'));
  const missingDevice =
    draft.deviceId && !devices.data?.some((item) => item.deviceId === draft.deviceId);
  const checking = draft.issue === 'configurationLoading' || draft.issue === 'devicesLoading';
  const canChooseDirectory =
    draft.deviceId &&
    devices.isConfirmed &&
    devices.data?.some(
      (item) => item.deviceId === draft.deviceId && item.online && !item.onlineUnknown,
    );

  return (
    <Flexbox gap={8}>
      <Flexbox horizontal align="center" gap={8} padding={8}>
        <Avatar
          avatar={typeof agent?.avatar === 'string' ? agent.avatar : DEFAULT_AVATAR}
          background={agent?.backgroundColor ?? undefined}
          size={28}
        />
        <Text ellipsis style={{ flex: 1 }}>
          {name}
        </Text>
        <ActionIcon
          aria-label={t('group.removeMember', { ns: 'chat' })}
          icon={X}
          size="small"
          title={t('group.removeMember', { ns: 'chat' })}
          onClick={() =>
            setDrafts((current) => current.filter((item) => item.agentId !== draft.agentId))
          }
        />
      </Flexbox>
      <Flexbox gap={8} {...stylex.props(styles.extra)}>
        {draft.initialized && (
          <>
            <Select
              aria-describedby={draft.issue ? `channel-agent-${draft.agentId}-issue` : undefined}
              aria-label={t('environment.deviceLabel', { name })}
              placeholder={t(requiresDevice ? 'environment.chooseDevice' : 'noDevice')}
              value={draft.deviceId ?? ''}
              options={[
                ...(!requiresDevice ? [{ label: t('noDevice'), value: '' }] : []),
                ...(missingDevice
                  ? [
                      {
                        disabled: true,
                        label: t('environment.unavailableDevice'),
                        value: draft.deviceId!,
                      },
                    ]
                  : []),
                ...(devices.data ?? []).map((device) => ({
                  disabled:
                    !devices.isConfirmed ||
                    !device.online ||
                    !!device.onlineUnknown ||
                    (device.scope === 'workspace' && device.visibility !== 'public'),
                  label: `${device.friendlyName || device.hostname || device.deviceId}${!devices.isConfirmed || device.onlineUnknown ? ` · ${t('environment.checkingDevice')}` : device.online ? '' : ` · ${t('offline')}`}`,
                  value: device.deviceId,
                })),
              ]}
              onChange={changeDevice}
            />
            {draft.deviceId && (
              <Button
                aria-label={t('environment.directoryLabel', { name })}
                disabled={!canChooseDirectory}
                icon={FolderOpen}
                title={draft.workingDirectory || t('chooseDirectory')}
                {...stylex.props(styles.directory)}
                onClick={() =>
                  openPickWorkingDirModal({
                    defaultPath: draft.workingDirectory,
                    deviceId: draft.deviceId,
                    onPick: ({ path }) => change({ workingDirectory: path }),
                  })
                }
              >
                <Text ellipsis>{draft.workingDirectory || t('chooseDirectory')}</Text>
              </Button>
            )}
          </>
        )}
        {draft.issue === 'configurationFailed' ? (
          <AsyncError
            error={sync.error}
            retrying={sync.isValidating}
            title={t('environment.configurationFailed')}
            variant="inline"
            onRetry={() => void retry()}
          />
        ) : draft.issue ? (
          <Text
            fontSize={12}
            id={`channel-agent-${draft.agentId}-issue`}
            role="status"
            type={checking ? 'secondary' : 'danger'}
          >
            {t(`environment.${draft.issue}`)}
          </Text>
        ) : null}
      </Flexbox>
    </Flexbox>
  );
};
