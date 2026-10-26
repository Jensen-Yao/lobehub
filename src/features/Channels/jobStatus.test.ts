import type { ChannelPublicJob } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import {
  channelJobStatus,
  channelJobTone,
  memberCurrentJob,
  messageReceiptJobs,
} from './jobStatus';

describe('Channel task status', () => {
  const job = (patch: Partial<ChannelPublicJob>) =>
    ({
      blockedCode: 'directory_locked',
      publicationRevoked: false,
      status: 'queued',
      writerHeld: false,
      ...patch,
    }) as ChannelPublicJob;
  it('shows a cancelled queued task as stopped even when its last blocking reason is retained', () => {
    expect(channelJobStatus(job({ status: 'cancelled', publicationRevoked: true }))).toBe(
      'status.cancelled',
    );
  });
  it('keeps termination pending until the device confirms the writer has stopped', () => {
    expect(
      channelJobStatus(job({ status: 'cancelled', publicationRevoked: true, writerHeld: true })),
    ).toBe('status.stopping');
  });
  it('shows a newly queued task as preparing, not waiting behind another Agent', () => {
    expect(channelJobStatus(job({ blockedCode: null }))).toBe('status.preparing');
  });
  it('explains when an earlier reply from the same Agent must finish first', () => {
    expect(channelJobStatus(job({ blockedCode: 'member_busy' }))).toBe('blocked.member_busy');
  });
  it('explains why a queued task is waiting', () => {
    expect(channelJobStatus(job({}))).toBe('blocked.directory_locked');
  });
});

describe('Channel task tone', () => {
  const job = (patch: Partial<ChannelPublicJob>) =>
    ({
      blockedCode: null,
      id: 'job',
      memberId: 'member',
      publicationRevoked: false,
      status: 'queued',
      writerHeld: false,
      ...patch,
    }) as ChannelPublicJob;

  it('marks blocked and still-stopping work for attention', () => {
    expect(channelJobTone(job({ blockedCode: 'device_offline' }))).toBe('attention');
    expect(channelJobTone(job({ publicationRevoked: true, writerHeld: true }))).toBe('attention');
  });

  it('settles a stopped task even while its last status is still running', () => {
    expect(channelJobTone(job({ publicationRevoked: true, status: 'running' }))).toBe('quiet');
  });

  it('separates working, finished and failed replies', () => {
    expect(channelJobTone(job({ status: 'running' }))).toBe('working');
    expect(channelJobTone(job({ status: 'completed' }))).toBe('done');
    expect(channelJobTone(job({ status: 'failed' }))).toBe('error');
  });

  it('keeps a failure visible after its publication was revoked', () => {
    expect(channelJobTone(job({ publicationRevoked: true, status: 'failed' }))).toBe('error');
  });

  it('shows only unfinished or failed receipts in a mixed reply group', () => {
    const jobs = [
      job({ id: 'done', status: 'completed' }),
      job({ id: 'preparing' }),
      job({ id: 'waiting', blockedCode: 'directory_locked' }),
      job({ id: 'running', status: 'running' }),
      job({ id: 'stopping', status: 'cancelled', publicationRevoked: true, writerHeld: true }),
      job({ id: 'failed', status: 'failed' }),
      job({ id: 'failed-revoked', status: 'failed', publicationRevoked: true }),
      job({ id: 'cancelled', status: 'cancelled' }),
      job({ id: 'stopped', status: 'running', publicationRevoked: true }),
    ];
    expect(messageReceiptJobs(jobs).map((entry) => entry.id)).toEqual([
      'preparing',
      'waiting',
      'running',
      'stopping',
      'failed',
      'failed-revoked',
    ]);
  });

  it('leaves no receipt row when all three Agents have replied', () => {
    expect(
      messageReceiptJobs(['codex', 'pi', 'native'].map((id) => job({ id, status: 'completed' }))),
    ).toEqual([]);
  });

  it('removes a receipt immediately after publication without waiting for writer cleanup', () => {
    expect(messageReceiptJobs([job({ status: 'completed', writerHeld: true })])).toEqual([]);
  });

  it('removes stopping feedback only when physical exit is confirmed', () => {
    const stopping = job({ status: 'cancelled', publicationRevoked: true, writerHeld: true });
    expect(messageReceiptJobs([stopping])).toEqual([stopping]);
    expect(messageReceiptJobs([{ ...stopping, writerHeld: false }])).toEqual([]);
  });

  it("picks a member's running reply before its queued ones", () => {
    const jobs = [
      job({ id: 'done', status: 'completed' }),
      job({ id: 'next' }),
      job({ id: 'now', status: 'running' }),
      job({ id: 'other', memberId: 'someone', status: 'running' }),
    ];
    expect(memberCurrentJob(jobs, 'member')?.id).toBe('now');
    expect(memberCurrentJob(jobs.slice(0, 2), 'member')?.id).toBe('next');
    expect(memberCurrentJob(jobs.slice(0, 1), 'member')).toBeUndefined();
  });
});
