import { Button, createModal, Empty, Flexbox, SearchBar, Text } from '@lobehub/ui';
import { useDebounce } from 'ahooks';
import { t } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncBoundary from '@/components/AsyncBoundary';
import AsyncError from '@/components/AsyncError';
import Avatar from '@/components/Avatar';
import { channelActions } from '@/store/channel';

function AddPeople({ channelId }: { channelId: string }) {
  const { t } = useTranslation('channel');
  const [search, setSearch] = useState('');
  const query = useDebounce(search, { wait: 200 });
  const { data, error, isLoading, mutate } = channelActions.useFetchUserCandidates(
    channelId,
    query,
  );
  const [pending, setPending] = useState<string>();
  const [saveError, setSaveError] = useState<unknown>();
  const [added, setAdded] = useState('');

  const add = async (userId: string, name: string) => {
    if (pending) return;
    setPending(userId);
    setSaveError(undefined);
    setAdded('');
    try {
      await channelActions.addUser(channelId, userId);
      setAdded(name);
      await mutate();
    } catch (cause) {
      console.error('Failed to add Channel member', cause);
      setSaveError(cause);
    } finally {
      setPending(undefined);
    }
  };

  return (
    <Flexbox gap={12}>
      <Text type="secondary">{t('people.description')}</Text>
      <SearchBar
        aria-label={t('people.search')}
        maxLength={100}
        placeholder={t('people.search')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {added && <Text role="status">{t('people.added', { name: added })}</Text>}
      {saveError !== undefined && (
        <AsyncError error={saveError} title={t('people.addFailed')} variant="inline" />
      )}
      <AsyncBoundary
        data={data}
        empty={<Empty title={t(query ? 'people.noMatches' : 'people.empty')} />}
        error={error}
        isEmpty={data?.length === 0}
        isLoading={isLoading}
        onRetry={() => void mutate()}
      >
        <Flexbox gap={8} style={{ maxHeight: 360, overflowY: 'auto' }}>
          {data?.map((person) => {
            const name = person.fullName || person.username || t('person');
            return (
              <Flexbox horizontal align="center" gap={8} key={person.userId}>
                <Avatar avatar={person.avatar || undefined} size={32} title={name} />
                <Text ellipsis style={{ flex: 1 }}>
                  {name}
                </Text>
                <Button
                  aria-label={t('people.addName', { name })}
                  disabled={!!pending}
                  loading={pending === person.userId}
                  size="small"
                  onClick={() => void add(person.userId, name)}
                >
                  {t('people.add')}
                </Button>
              </Flexbox>
            );
          })}
        </Flexbox>
        {data?.length === 50 && <Text type="secondary">{t('people.searchMore')}</Text>}
      </AsyncBoundary>
    </Flexbox>
  );
}

export const openAddChannelPeople = (channelId: string) =>
  createModal({
    content: <AddPeople channelId={channelId} />,
    footer: null,
    title: t('people.title', { ns: 'channel' }),
    width: 'min(90vw, 480px)',
  });
