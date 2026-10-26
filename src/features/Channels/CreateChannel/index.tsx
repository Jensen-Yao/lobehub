import { agentDisplayName, CHANNEL_LIMITS } from '@lobechat/types';
import { Button, createModal, Flexbox, Icon, Input, Text, useModalContext } from '@lobehub/ui';
import { t } from 'i18next';
import { Hash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { channelActions } from '@/store/channel';

import type { ChannelAgentDraft } from './agentEnvironment';
import { canSubmitChannelAgents, toChannelAgentSelection } from './agentEnvironment';
import { AgentSelection } from './AgentSelection';
import { defaultChannelTitle } from './channelTitle';
import { getChannelSaveErrorKey } from './saveError';
import { useChannelAgentOptions } from './useChannelAgentOptions';

interface CreateChannelProps {
  /** Set when adding members to a Channel that already exists. */
  existing?: { agentIds: string[]; id: string };
  onCreated?: (id: string) => void;
}

export const openCreateChannel = (props: CreateChannelProps = {}) =>
  createModal({
    content: <CreateChannel {...props} />,
    footer: null,
    title: t(props.existing ? 'addMembers' : 'create', { ns: 'channel' }),
    width: 'min(90vw, 800px)',
  });

/**
 * Like starting a group chat: choose members first. The name is optional and defaults to the
 * members' names; the sidebar renames it later. Adding members to an existing Channel uses
 * the same picker without a name.
 */
function CreateChannel({ existing, onCreated }: CreateChannelProps) {
  const { t } = useTranslation('channel');
  const { close, setCanDismissByClickOutside } = useModalContext();
  const [title, setTitle] = useState('');
  const [agents, setAgents] = useState<ChannelAgentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const options = useChannelAgentOptions();
  const dirty = !!title.trim() || agents.length > 0;

  // A mask click must not drop what the user typed or picked; ✕ and Esc still close.
  useEffect(() => {
    setCanDismissByClickOutside(!dirty && !busy);
  }, [busy, dirty, setCanDismissByClickOutside]);

  const autoTitle = defaultChannelTitle(
    agents.map(({ agentId }) =>
      agentDisplayName(
        options.agents?.find((agent) => agent.id === agentId),
        t('unnamedAgent'),
      ),
    ),
    {
      more: (names, count, total) => t('autoTitle.more', { count, names, total }),
      separator: t('autoTitle.separator'),
    },
    CHANNEL_LIMITS.titleLength,
  );
  const canSubmit = canSubmitChannelAgents(agents);

  const submit = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(undefined);
    try {
      const selections = agents.map(toChannelAgentSelection);
      if (existing) {
        await channelActions.addAgents(existing.id, selections);
        close();
      } else {
        const id = await channelActions.create({
          agents: selections,
          title: title.trim() || autoTitle,
        });
        close();
        onCreated?.(id);
      }
    } catch (cause) {
      console.error('Failed to save Channel members', cause);
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Flexbox gap={16}>
      <Flexbox gap={8} inert={busy}>
        <Text weight={500}>{t('agents')}</Text>
        <AgentSelection
          exclude={existing?.agentIds}
          options={options}
          value={agents}
          onChange={setAgents}
        />
      </Flexbox>
      {!existing && (
        <Flexbox gap={6} inert={busy}>
          <label htmlFor="channel-title" style={{ fontWeight: 500 }}>
            {t('nameOptional')}
          </label>
          <Input
            id="channel-title"
            maxLength={CHANNEL_LIMITS.titleLength}
            placeholder={autoTitle || t('nameAutoPlaceholder')}
            prefix={<Icon icon={Hash} size={14} />}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onPressEnter={() => void submit()}
          />
        </Flexbox>
      )}
      {error !== undefined && (
        <AsyncError error={error} title={t(getChannelSaveErrorKey(error))} variant="inline" />
      )}
      <Flexbox horizontal align="center" gap={8} justify="flex-end">
        {agents.length > 0 && !canSubmit && (
          <Text fontSize={12} type="secondary">
            {t('environment.completeRequired')}
          </Text>
        )}
        <Button disabled={busy} onClick={close}>
          {t('cancel')}
        </Button>
        <Button disabled={!canSubmit} loading={busy} type="primary" onClick={() => void submit()}>
          {t(existing ? 'addMembers' : 'submit')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
}
