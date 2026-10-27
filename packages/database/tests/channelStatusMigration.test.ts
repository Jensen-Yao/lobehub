// @vitest-environment node
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import journal from '../migrations/meta/_journal.json';

const migrationsFolder = path.join(__dirname, '../migrations');
const TAG = '0190_channel_status';

const ROOT_MESSAGE_ID = '00000000-0000-4000-8000-000000000001';
const ACTIVE_MEMBER_ID = '00000000-0000-4000-8000-000000000011';
const LEFT_MEMBER_ID = '00000000-0000-4000-8000-000000000012';

const readStatuses = async (client: PGlite) => ({
  channels: (await client.query('SELECT id, status FROM channels ORDER BY id')).rows,
  members: (await client.query('SELECT id, status FROM channel_members ORDER BY id')).rows,
  threads: (await client.query('SELECT id, status FROM channel_threads ORDER BY id')).rows,
});

describe('Channel status upgrade', () => {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle({ client });
  let historicalFolder: string;

  beforeAll(async () => {
    historicalFolder = await mkdtemp(path.join(tmpdir(), 'lobe-channel-status-migration-'));
    await mkdir(path.join(historicalFolder, 'meta'));
    const last = journal.entries.findIndex(({ tag }) => tag === TAG);
    const entries = journal.entries.slice(0, last);
    await Promise.all([
      writeFile(
        path.join(historicalFolder, 'meta/_journal.json'),
        JSON.stringify({ ...journal, entries }),
      ),
      ...entries.map(({ tag }) =>
        copyFile(
          path.join(migrationsFolder, `${tag}.sql`),
          path.join(historicalFolder, `${tag}.sql`),
        ),
      ),
    ]);
    await migrate(db, { migrationsFolder: historicalFolder });
    await client.query(`INSERT INTO channels (id, title, sequence) VALUES ('chn_team', 'Team', 1)`);
    await client.query(
      `INSERT INTO channel_members (id, channel_id, actor_type, role, active)
       VALUES ($1, 'chn_team', 'user', 'owner', true), ($2, 'chn_team', 'user', 'member', false)`,
      [ACTIVE_MEMBER_ID, LEFT_MEMBER_ID],
    );
    await client.query(
      `INSERT INTO channel_messages (id, channel_id, sequence, content, request_key, routing_status)
       VALUES ($1, 'chn_team', 1, 'Root', 'req_root', 'skipped')`,
      [ROOT_MESSAGE_ID],
    );
    await client.query(
      `INSERT INTO channel_threads (id, channel_id, root_message_id, root_sequence)
       VALUES ('thd_root', 'chn_team', $1, 1)`,
      [ROOT_MESSAGE_ID],
    );
    await migrate(db, { migrationsFolder });
  }, 30_000);

  afterAll(async () => {
    await client.close();
    if (historicalFolder) await rm(historicalFolder, { force: true, recursive: true });
  });

  it('starts existing rows active and keeps members who left as left', async () => {
    expect(await readStatuses(client)).toEqual({
      channels: [{ id: 'chn_team', status: 'active' }],
      members: [
        { id: ACTIVE_MEMBER_ID, status: 'active' },
        { id: LEFT_MEMBER_ID, status: 'left' },
      ],
      threads: [{ id: 'thd_root', status: 'active' }],
    });
    const columns = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'channel_members' AND column_name = 'active'`,
    );
    expect(columns.rows).toHaveLength(0);
  });

  it('lets an archived Thread keep holding its root message', async () => {
    await client.query(`UPDATE channel_threads SET status = 'archived' WHERE id = 'thd_root'`);
    await expect(
      client.query(
        `INSERT INTO channel_threads (id, channel_id, root_message_id, root_sequence)
         VALUES ('thd_second', 'chn_team', $1, 1)`,
        [ROOT_MESSAGE_ID],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await client.query(`UPDATE channel_threads SET status = 'active' WHERE id = 'thd_root'`);
  });

  it('replays safely once the active flag is gone', async () => {
    const before = await readStatuses(client);
    const entry = journal.entries.find(({ tag }) => tag === TAG);
    const migration = readMigrationFiles({ migrationsFolder }).find(
      ({ folderMillis }) => folderMillis === entry?.when,
    );
    if (!migration) throw new Error('Channel status migration not found');
    await db.transaction(async (tx) => {
      for (const statement of migration.sql) await tx.execute(statement);
    });
    expect(await readStatuses(client)).toEqual(before);
  });
});
