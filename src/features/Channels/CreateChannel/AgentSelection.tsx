import { getHeterogeneousTypeLabel } from '@lobechat/heterogeneous-agents';
import { agentDisplayName } from '@lobechat/types';
import { Checkbox, Flexbox, SearchBar, Tag, Text } from '@lobehub/ui';
import { cssVar } from '@lobehub/ui/stylex/cssVar.stylex';
import * as stylex from '@stylexjs/stylex';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncBoundary from '@/components/AsyncBoundary';
import AsyncError from '@/components/AsyncError';
import Avatar from '@/components/Avatar';
import { DEFAULT_AVATAR } from '@/const/meta';
import AgentSelectionEmpty from '@/features/AgentSelectionEmpty';
import { useDeviceList } from '@/store/device/useDeviceList';

import type { ChannelAgentDraft } from './agentEnvironment';
import { SelectedAgent } from './SelectedAgent';
import type { ChannelAgentOption, useChannelAgentOptions } from './useChannelAgentOptions';

const styles = stylex.create({
  picker: {
    display: 'flex',
    gap: 8,
    height: 500,
    maxHeight: '55vh',
    minHeight: 240,
    padding: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: cssVar.colorBorderSecondary,
    borderRadius: cssVar.borderRadiusLG,
  },
  pane: { flex: '1', minWidth: 0, minHeight: 0, overflowY: 'auto' },
  selected: {
    borderInlineStartWidth: 1,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: cssVar.colorBorderSecondary,
    paddingInlineStart: 12,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    cursor: 'pointer',
    borderRadius: cssVar.borderRadius,
    backgroundColor: { 'default': 'transparent', ':hover': cssVar.colorFillTertiary },
  },
});

/** Name plus the external runtime, which is why a coding Agent asks for a device. */
const AgentLabel = ({ agent, fallback }: { agent?: ChannelAgentOption; fallback: string }) => (
  <Flexbox horizontal align="center" flex={1} gap={6} style={{ minWidth: 0 }}>
    <Text ellipsis>{agentDisplayName(agent, fallback)}</Text>
    {agent?.runtime && (
      <Tag size="small" style={{ flex: 'none' }}>
        {getHeterogeneousTypeLabel(agent.runtime)}
      </Tag>
    )}
  </Flexbox>
);

export const AgentSelection = ({
  exclude = [],
  options,
  value,
  onChange,
}: {
  /** Agents already in the Channel. */
  exclude?: string[];
  onChange: Dispatch<SetStateAction<ChannelAgentDraft[]>>;
  options: ReturnType<typeof useChannelAgentOptions>;
  value: ChannelAgentDraft[];
}) => {
  const { t } = useTranslation(['channel', 'device', 'chat', 'common']);
  const { agents } = options;
  const [search, setSearch] = useState('');
  const available = (agents ?? []).filter((agent) => !exclude.includes(agent.id));
  const filtered = available.filter((agent) =>
    `${agentDisplayName(agent, t('unnamedAgent'))} ${agent.description ?? ''}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const toggle = (agentId: string) =>
    onChange((current) =>
      current.some((item) => item.agentId === agentId)
        ? current.filter((item) => item.agentId !== agentId)
        : [...current, { agentId, initialized: false, issue: 'configurationLoading' }],
    );
  const devices = useDeviceList({ refreshInterval: 15_000 });

  return (
    <Flexbox gap={12}>
      <AsyncBoundary
        data={agents}
        error={options.error}
        isLoading={!agents && !options.error}
        onRetry={options.retry}
      >
        <div {...stylex.props(styles.picker)}>
          <Flexbox gap={8} {...stylex.props(styles.pane)}>
            <SearchBar
              allowClear
              placeholder={t('searchAgents')}
              value={search}
              variant="filled"
              onChange={(event) => setSearch(event.target.value)}
            />
            <Flexbox {...stylex.props(styles.pane)}>
              {filtered.length ? (
                filtered.map((agent) => (
                  <label key={agent.id} {...stylex.props(styles.row)}>
                    <Checkbox
                      checked={value.some((item) => item.agentId === agent.id)}
                      onChange={() => toggle(agent.id)}
                    />
                    <Avatar
                      avatar={typeof agent.avatar === 'string' ? agent.avatar : DEFAULT_AVATAR}
                      background={agent.backgroundColor ?? undefined}
                      size={28}
                    />
                    <AgentLabel agent={agent} fallback={t('unnamedAgent')} />
                  </label>
                ))
              ) : (
                <AgentSelectionEmpty search={!!search.trim()} variant="noAvailable" />
              )}
            </Flexbox>
          </Flexbox>
          <Flexbox gap={8} {...stylex.props(styles.pane, styles.selected)}>
            <Text fontSize={12} type="secondary">
              {t('memberSelection.selectedAgents', { ns: 'chat', count: value.length })}
            </Text>
            {!value.length && <AgentSelectionEmpty variant="noSelected" />}
            {!!devices.error && (
              <AsyncError
                error={devices.error}
                retrying={devices.isValidating}
                title={t('environment.devicesFailed')}
                variant="inline"
                onRetry={() => void devices.mutate()}
              />
            )}
            {value.map((draft) => (
              <SelectedAgent
                agent={agents?.find((agent) => agent.id === draft.agentId)}
                devices={devices}
                draft={draft}
                key={draft.agentId}
                setDrafts={onChange}
              />
            ))}
          </Flexbox>
        </div>
      </AsyncBoundary>
      <Text fontSize={12} type="secondary">
        {t('environment.defaultsHint')}
      </Text>
    </Flexbox>
  );
};
