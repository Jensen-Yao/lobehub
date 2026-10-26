import type { ChannelPublicMember, ChannelPublicMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { draftThreadFollowerIds } from './threadDraft';

const members = [
  { id: 'author', actorType: 'agent', agentId: 'agent', active: true },
  { id: 'recipient', actorType: 'agent', agentId: 'other-agent', active: true },
  { id: 'inactive', actorType: 'agent', agentId: 'agent', active: false },
  { id: 'unrelated', actorType: 'agent', agentId: 'third-agent', active: true },
  { id: 'person', actorType: 'user', userId: 'user', active: true },
] as ChannelPublicMember[];
const root = (author: ChannelPublicMessage['author'], recipientMemberIds: string[]) =>
  ({ author, recipientMemberIds }) as ChannelPublicMessage;

describe('Thread preview followers', () => {
  it('includes the active reply author and selected recipients, without duplicates', () => {
    expect(
      draftThreadFollowerIds(
        root({ type: 'agent', id: 'agent', avatar: null, name: 'Agent' }, [
          'author',
          'recipient',
          'inactive',
        ]),
        members,
      ),
    ).toEqual(['author', 'recipient']);
  });
  it('does not enroll a human author or unrelated Agents', () => {
    expect(
      draftThreadFollowerIds(
        root({ type: 'user', id: 'user', avatar: null, name: 'User' }, ['recipient']),
        members,
      ),
    ).toEqual(['recipient']);
  });
  it('keeps an unavailable author out of the preview', () => {
    expect(
      draftThreadFollowerIds(
        root({ type: 'agent', id: null, avatar: null, name: null }, []),
        members,
      ),
    ).toEqual([]);
  });
});
