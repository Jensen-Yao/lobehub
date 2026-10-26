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
import { getChannelSaveErrorKey } from './saveError';
import { useChannelAgentOptions } from './useChannelAgentOptions';

/** Matches the `title` bound in `apps/server/src/routers/lambda/channel.ts`. */
const TITLE_MAX_LENGTH = 100;

type ChannelStep = 'members' | 'name';
const MODAL_WIDTH: Record<ChannelStep, string> = {
  members: 'min(90vw, 800px)',
  name: 'min(90vw, 480px)',
};

interface CreateChannelProps {
  /** Set when adding members to a Channel that already exists. */
  existing?: { agentIds: string[]; id: string; title: string };
  onCreated?: (id: string) => void;
}

export const openCreateChannel = (props: CreateChannelProps = {}) => {
  const modal = createModal({
    content: (
      <CreateChannel
        {...props}
        onStepChange={(step) => modal.update({ width: MODAL_WIDTH[step] })}
      />
    ),
    footer: null,
    title: t(props.existing ? 'addMembers' : 'create', { ns: 'channel' }),
    width: MODAL_WIDTH[props.existing ? 'members' : 'name'],
  });
  return modal;
};

/**
 * Creating asks for the name first, so the name rule is the only thing that can fail on that
 * screen; choosing members and where each one runs comes after. Adding members to an existing
 * Channel starts on the member step.
 */
function CreateChannel({
  existing,
  onCreated,
  onStepChange,
}: CreateChannelProps & { onStepChange: (step: ChannelStep) => void }) {
  const { t } = useTranslation(['channel', 'common']);
  const { close, setCanDismissByClickOutside } = useModalContext();
  const [step, setStep] = useState<ChannelStep>(existing ? 'members' : 'name');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [agents, setAgents] = useState<ChannelAgentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const options = useChannelAgentOptions();
  const dirty = (!existing && !!title.trim()) || agents.length > 0;

  // A mask click must not drop what the user typed or picked; ✕ and Esc still close.
  useEffect(() => {
    setCanDismissByClickOutside(!dirty && !busy);
  }, [busy, dirty, setCanDismissByClickOutside]);

  const changeStep = (next: ChannelStep) => {
    setStep(next);
    onStepChange(next);
  };

  const openMembers = () => {
    if (!title.trim()) {
      setTitleInvalid(true);
      return;
    }
    changeStep('members');
  };

  const submit = async () => {
    if (busy || !canSubmitChannelAgents(agents)) return;
    setBusy(true);
    setError(undefined);
    try {
      const selections = agents.map(toChannelAgentSelection);
      if (existing) {
        await channelActions.addAgents(existing.id, selections);
        close();
      } else {
        const id = await channelActions.create({ agents: selections, title: title.trim() });
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

  if (step === 'name')
    return (
      <Flexbox gap={20}>
        <Flexbox gap={8}>
          <Text type="secondary">{t('description')}</Text>
          <Flexbox gap={6}>
            <label htmlFor="channel-title" style={{ fontWeight: 500 }}>
              {t('name')}
            </label>
            <Input
              autoFocus
              aria-describedby={titleInvalid ? 'channel-title-error' : undefined}
              aria-invalid={titleInvalid || undefined}
              id="channel-title"
              maxLength={TITLE_MAX_LENGTH}
              placeholder={t('namePlaceholder')}
              prefix={<Icon icon={Hash} size={14} />}
              value={title}
              onPressEnter={openMembers}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleInvalid(false);
              }}
            />
            {titleInvalid && (
              <Text fontSize={12} id="channel-title-error" type="danger">
                {t('nameRequired')}
              </Text>
            )}
          </Flexbox>
        </Flexbox>
        <Flexbox horizontal gap={8} justify="flex-end">
          <Button onClick={close}>{t('cancel')}</Button>
          <Button type="primary" onClick={openMembers}>
            {t('chooseMembers')}
          </Button>
        </Flexbox>
      </Flexbox>
    );

  const canSubmit = canSubmitChannelAgents(agents);
  return (
    <Flexbox gap={20}>
      <Flexbox horizontal align="center" gap={6}>
        <Icon icon={Hash} size={16} />
        <Text ellipsis weight={500}>
          {title.trim()}
        </Text>
      </Flexbox>
      <Flexbox gap={8} inert={busy}>
        <Text weight={500}>{t('agents')}</Text>
        <AgentSelection
          exclude={existing?.agentIds}
          options={options}
          value={agents}
          onChange={setAgents}
        />
      </Flexbox>
      {error !== undefined && (
        <AsyncError error={error} title={t(getChannelSaveErrorKey(error))} variant="inline" />
      )}
      <Flexbox horizontal align="center" gap={8} justify="flex-end">
        {agents.length > 0 && !canSubmit && (
          <Text fontSize={12} type="secondary">
            {t('environment.completeRequired')}
          </Text>
        )}
        <Button disabled={busy} onClick={existing ? close : () => changeStep('name')}>
          {existing ? t('cancel') : t('back', { ns: 'common' })}
        </Button>
        <Button disabled={!canSubmit} loading={busy} type="primary" onClick={() => void submit()}>
          {t(existing ? 'addMembers' : 'submit')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
}
