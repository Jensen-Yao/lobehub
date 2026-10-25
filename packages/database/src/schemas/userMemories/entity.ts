import type {
  UserMemoryEntityMentionRole,
  UserMemoryEntityNameKind,
  UserMemoryEntityType,
} from '@lobechat/types';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

import { idGenerator } from '../../utils/idGenerator';
import { timestamps, varchar255 } from '../_helpers';
import { users } from '../user';
import { userMemories } from './base';

/**
 * A person, organization, product, repository or place the user deals with. The user is the
 * entity with `is_self`. Names, facts (identities) and preferences hang off entities.
 */
export const userMemoriesEntities = pgTable(
  'user_memories_entities',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),
    /** e.g. a fund under its firm, a subsidiary under its group. */
    parentEntityId: varchar255('parent_entity_id').references(
      (): AnyPgColumn => userMemoriesEntities.id,
      { onDelete: 'set null' },
    ),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    /** Canonical name; other names live in `user_memories_entity_names`. */
    name: text('name').notNull(),
    type: text('type').$type<UserMemoryEntityType>().notNull().default('other'),
    relationship: text('relationship'),
    role: text('role'),
    description: text('description'),
    descriptionVector: vector('description_vector', { dimensions: 1024 }),
    isSelf: boolean('is_self').notNull().default(false),

    ...timestamps,
  },
  (table) => [
    index('user_memories_entities_description_vector_index').using(
      'hnsw',
      table.descriptionVector.op('vector_cosine_ops'),
    ),
    index('user_memories_entities_user_id_index').on(table.userId),
    index('user_memories_entities_parent_entity_id_index').on(table.parentEntityId),
    uniqueIndex('user_memories_entities_user_id_self_unique')
      .on(table.userId)
      .where(sql`${table.isSelf}`),
  ],
);

/** Every name an entity goes by, including old names and names the user corrected away from. */
export const userMemoriesEntityNames = pgTable(
  'user_memories_entity_names',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    entityId: varchar255('entity_id')
      .references(() => userMemoriesEntities.id, { onDelete: 'cascade' })
      .notNull(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    /** Lower-cased, whitespace-collapsed form used for exact resolution. */
    normalized: text('normalized').notNull(),
    kind: text('kind').$type<UserMemoryEntityNameKind>().notNull().default('alias'),
    /** The memory that stated this name. */
    sourceMemoryId: varchar255('source_memory_id').references(() => userMemories.id, {
      onDelete: 'set null',
    }),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('user_memories_entity_names_entity_id_normalized_unique').on(
      table.entityId,
      table.normalized,
    ),
    index('user_memories_entity_names_user_id_normalized_index').on(table.userId, table.normalized),
  ],
);

/** Names stated to be different things, so resolution never merges them. */
export const userMemoriesEntityDistinctions = pgTable(
  'user_memories_entity_distinctions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    /** Normalized names, stored with `name_a < name_b` so a pair has one row. */
    nameA: text('name_a').notNull(),
    nameB: text('name_b').notNull(),
    sourceMemoryId: varchar255('source_memory_id').references(() => userMemories.id, {
      onDelete: 'set null',
    }),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('user_memories_entity_distinctions_user_id_names_unique').on(
      table.userId,
      table.nameA,
      table.nameB,
    ),
  ],
);

/** Which memories mention which entities; the main way to find candidates when consolidating. */
export const userMemoriesEntityMentions = pgTable(
  'user_memories_entity_mentions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userMemoryId: varchar255('user_memory_id')
      .references(() => userMemories.id, { onDelete: 'cascade' })
      .notNull(),
    entityId: varchar255('entity_id')
      .references(() => userMemoriesEntities.id, { onDelete: 'cascade' })
      .notNull(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    role: text('role').$type<UserMemoryEntityMentionRole>().notNull().default('mention'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('user_memories_entity_mentions_memory_entity_role_unique').on(
      table.userMemoryId,
      table.entityId,
      table.role,
    ),
    index('user_memories_entity_mentions_entity_id_index').on(table.entityId),
  ],
);

export type UserMemoryEntity = typeof userMemoriesEntities.$inferSelect;
export type NewUserMemoryEntity = typeof userMemoriesEntities.$inferInsert;

export type UserMemoryEntityName = typeof userMemoriesEntityNames.$inferSelect;
export type NewUserMemoryEntityName = typeof userMemoriesEntityNames.$inferInsert;
