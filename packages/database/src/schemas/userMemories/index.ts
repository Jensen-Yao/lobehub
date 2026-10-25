import type {
  UserMemoryContextProjectSource,
  UserMemoryDossierDecision,
  UserMemoryDossierStatus,
  UserMemoryEntityMentionRole,
  UserMemoryEntityNameKind,
  UserMemoryEntityType,
  UserMemoryEvidenceSource,
  UserMemoryOperationActor,
  UserMemoryOperationGate,
  UserMemoryOperationState,
  UserMemoryOperationType,
  UserMemoryState,
} from '@lobechat/types';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

import { idGenerator } from '../../utils/idGenerator';
import { softDeleteColumns, timestamps, timestamptz, varchar255 } from '../_helpers';
import { projects } from '../project';
import { users } from '../user';

export const userMemories = pgTable(
  'user_memories',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    memoryCategory: varchar255('memory_category'),
    memoryLayer: varchar255('memory_layer'),
    memoryType: varchar255('memory_type'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    tags: text('tags').array(),

    title: varchar255('title'),
    summary: text('summary'),
    summaryVector1024: vector('summary_vector_1024', { dimensions: 1024 }),
    details: text('details'),
    detailsVector1024: vector('details_vector_1024', { dimensions: 1024 }),

    status: varchar255('status'),
    /** Whether the memory may be used in conversations yet; unset rows predate the lifecycle. */
    state: text('state').$type<UserMemoryState>(),
    /** Set when the user edited the memory; automatic consolidation must not overwrite it. */
    userLocked: boolean('user_locked').default(false),

    /**
     * Soft references to the conversation the memory was extracted from. No foreign key: the
     * table is large and topics are deleted often, so a cascade would scan it on every delete.
     */
    topicId: text('topic_id'),
    messageIds: jsonb('message_ids').$type<string[]>(),

    accessedCount: bigint('accessed_count', { mode: 'number' }).default(0),
    lastAccessedAt: timestamptz('last_accessed_at').notNull(),
    capturedAt: timestamptz('captured_at').notNull().defaultNow(),

    /** Recycle bin — see `schemas/trash.ts`. */
    ...softDeleteColumns(),
    ...timestamps,
  },
  (table) => [
    index('user_memories_summary_vector_1024_index').using(
      'hnsw',
      table.summaryVector1024.op('vector_cosine_ops'),
    ),
    index('user_memories_details_vector_1024_index').using(
      'hnsw',
      table.detailsVector1024.op('vector_cosine_ops'),
    ),
    index('user_memories_user_id_index').on(table.userId),
    index('user_memories_topic_id_index')
      .on(table.topicId)
      .where(sql`${table.topicId} IS NOT NULL`),
  ],
);

export const userMemoriesContexts = pgTable(
  'user_memories_contexts',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** Parent row in `user_memories`, like every other layer, so contexts share search and access stats. */
    userMemoryId: varchar255('user_memory_id').references(() => userMemories.id, {
      onDelete: 'cascade',
    }),
    /** @deprecated Loose links from the per-topic era; dossiers now point at their context. */
    userMemoryIds: jsonb('user_memory_ids').$type<string[]>(),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    tags: text('tags').array(),

    associatedObjects:
      jsonb('associated_objects').$type<
        { extra?: Record<string, unknown>; name?: string; type?: string }[]
      >(),
    associatedSubjects:
      jsonb('associated_subjects').$type<
        { extra?: Record<string, unknown>; name?: string; type?: string }[]
      >(),

    title: text('title'),
    description: text('description'),
    descriptionVector: vector('description_vector', { dimensions: 1024 }),

    type: varchar255('type'),
    currentStatus: text('current_status'),

    scoreImpact: numeric('score_impact', { mode: 'number' }).default(0),
    scoreUrgency: numeric('score_urgency', { mode: 'number' }).default(0),

    /** Where things stand now, synthesized from the dossiers' evidence. */
    now: text('now'),
    nextSteps: jsonb('next_steps').$type<string[]>(),
    openQuestions: jsonb('open_questions').$type<string[]>(),
    firstSeenAt: timestamptz('first_seen_at'),
    /** Status is derived from this, not from what an extractor wrote. */
    lastEvidenceAt: timestamptz('last_evidence_at'),
    /** Last periodic regroup that rewrote this context. */
    synthesizedAt: timestamptz('synthesized_at'),

    capturedAt: timestamptz('captured_at').notNull().defaultNow(),

    ...timestamps,
  },
  (table) => [
    index('user_memories_contexts_description_vector_index').using(
      'hnsw',
      table.descriptionVector.op('vector_cosine_ops'),
    ),
    index('user_memories_contexts_type_index').on(table.type),
    index('user_memories_contexts_user_id_index').on(table.userId),
    index('user_memories_contexts_user_memory_ids_gin_idx').using('gin', table.userMemoryIds),
    index('user_memories_contexts_user_memory_id_index').on(table.userMemoryId),
    index('user_memories_contexts_user_id_last_evidence_at_index').on(
      table.userId,
      table.lastEvidenceAt,
    ),
  ],
);

/**
 * A concrete item inside a context (one feature, one deal, one investigation). Activities are its
 * evidence; its summary, "now" and decisions are synthesized from them.
 */
export const userMemoriesDossiers = pgTable(
  'user_memories_dossiers',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),
    /** Null until the periodic regroup places the dossier in a context. */
    contextId: varchar255('context_id').references(() => userMemoriesContexts.id, {
      onDelete: 'set null',
    }),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    userMemoryId: varchar255('user_memory_id').references(() => userMemories.id, {
      onDelete: 'cascade',
    }),

    title: text('title'),
    summary: text('summary'),
    summaryVector: vector('summary_vector', { dimensions: 1024 }),
    now: text('now'),
    decisions: jsonb('decisions').$type<UserMemoryDossierDecision[]>(),

    status: text('status').$type<UserMemoryDossierStatus>().notNull().default('active'),
    firstSeenAt: timestamptz('first_seen_at'),
    lastEvidenceAt: timestamptz('last_evidence_at'),
    activityCount: integer('activity_count').notNull().default(0),

    ...timestamps,
  },
  (table) => [
    index('user_memories_dossiers_summary_vector_index').using(
      'hnsw',
      table.summaryVector.op('vector_cosine_ops'),
    ),
    index('user_memories_dossiers_context_id_index').on(table.contextId),
    index('user_memories_dossiers_user_id_last_evidence_at_index').on(
      table.userId,
      table.lastEvidenceAt,
    ),
    index('user_memories_dossiers_user_memory_id_index').on(table.userMemoryId),
  ],
);

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

export const userMemoriesPreferences = pgTable(
  'user_memories_preferences',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    userMemoryId: varchar255('user_memory_id').references(() => userMemories.id, {
      onDelete: 'cascade',
    }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    tags: text('tags').array(),

    conclusionDirectives: text('conclusion_directives'),
    conclusionDirectivesVector: vector('conclusion_directives_vector', { dimensions: 1024 }),

    type: varchar255('type'),
    suggestions: text('suggestions'),

    scorePriority: numeric('score_priority', { mode: 'number' }).default(0),

    /** Whose preference this is; null means the user (rows from before entities existed). */
    holderEntityId: varchar255('holder_entity_id').references(() => userMemoriesEntities.id, {
      onDelete: 'set null',
    }),
    /** Set when the rule only applies when this entity is involved. */
    appliesToEntityId: varchar255('applies_to_entity_id').references(
      () => userMemoriesEntities.id,
      { onDelete: 'set null' },
    ),
    /** Situation the preference applies to, e.g. weekly reports or investor updates. */
    scope: text('scope'),
    evidenceSource: text('evidence_source').$type<UserMemoryEvidenceSource>(),
    evidenceCount: integer('evidence_count').notNull().default(1),
    lastEvidenceAt: timestamptz('last_evidence_at'),

    capturedAt: timestamptz('captured_at').notNull().defaultNow(),

    ...timestamps,
  },
  (table) => [
    index('user_memories_preferences_conclusion_directives_vector_index').using(
      'hnsw',
      table.conclusionDirectivesVector.op('vector_cosine_ops'),
    ),
    index('user_memories_preferences_user_id_index').on(table.userId),
    index('user_memories_preferences_user_memory_id_index').on(table.userMemoryId),
    index('user_memories_preferences_holder_entity_id_index').on(table.holderEntityId),
    index('user_memories_preferences_applies_to_entity_id_index').on(table.appliesToEntityId),
  ],
);

export const userMemoriesActivities = pgTable(
  'user_memories_activities',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    userMemoryId: varchar255('user_memory_id').references(() => userMemories.id, {
      onDelete: 'cascade',
    }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    tags: text('tags').array(),

    type: varchar255('type').notNull(),
    status: varchar255('status').notNull().default('pending'),
    timezone: varchar255('timezone'),
    startsAt: timestamptz('starts_at'),
    endsAt: timestamptz('ends_at'),

    associatedObjects: jsonb('associated_objects').$type<
      {
        extra?: Record<string, unknown>;
        name?: string;
        type?: string;
      }[]
    >(),
    associatedSubjects: jsonb('associated_subjects').$type<
      {
        extra?: Record<string, unknown>;
        name?: string;
        type?: string;
      }[]
    >(),
    associatedLocations: jsonb('associated_locations').$type<
      {
        address?: string;
        name?: string;
        tags?: string[];
        type?: string;
      }[]
    >(),

    notes: text('notes'),
    narrative: text('narrative'),
    narrativeVector: vector('narrative_vector', { dimensions: 1024 }),
    feedback: text('feedback'),
    feedbackVector: vector('feedback_vector', { dimensions: 1024 }),

    /** The dossier this activity is evidence for. Activities are not edited after they are written. */
    dossierId: varchar255('dossier_id').references(() => userMemoriesDossiers.id, {
      onDelete: 'set null',
    }),
    /** Soft references to the source conversation; see `user_memories.topic_id`. */
    topicId: text('topic_id'),
    messageIds: jsonb('message_ids').$type<string[]>(),
    /** Inherited from the topic so contexts can be linked to projects without a join. */
    projectId: text('project_id'),
    /** False for evidence that should never be injected on its own (cron run logs, one-off Q&A). */
    injectable: boolean('injectable').notNull().default(true),

    capturedAt: timestamptz('captured_at').notNull().defaultNow(),

    ...timestamps,
  },
  (table) => [
    index('user_memories_activities_narrative_vector_index').using(
      'hnsw',
      table.narrativeVector.op('vector_cosine_ops'),
    ),
    index('user_memories_activities_feedback_vector_index').using(
      'hnsw',
      table.feedbackVector.op('vector_cosine_ops'),
    ),
    index('user_memories_activities_type_index').on(table.type),
    index('user_memories_activities_user_id_index').on(table.userId),
    index('user_memories_activities_user_memory_id_index').on(table.userMemoryId),
    index('user_memories_activities_status_index').on(table.status),
    index('user_memories_activities_dossier_id_index')
      .on(table.dossierId)
      .where(sql`${table.dossierId} IS NOT NULL`),
  ],
);

export const userMemoriesIdentities = pgTable(
  'user_memories_identities',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    userMemoryId: varchar255('user_memory_id').references(() => userMemories.id, {
      onDelete: 'cascade',
    }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    tags: text('tags').array(),

    type: varchar255('type'),
    description: text('description'),
    descriptionVector: vector('description_vector', { dimensions: 1024 }),
    episodicDate: timestamptz('episodic_date'),
    relationship: varchar255('relationship'),
    role: text('role'),

    /** The entity this fact is about; null for rows from before entities existed. */
    entityId: varchar255('entity_id').references(() => userMemoriesEntities.id, {
      onDelete: 'set null',
    }),

    capturedAt: timestamptz('captured_at').notNull().defaultNow(),

    ...timestamps,
  },
  (table) => [
    index('user_memories_identities_description_vector_index').using(
      'hnsw',
      table.descriptionVector.op('vector_cosine_ops'),
    ),
    index('user_memories_identities_type_index').on(table.type),
    index('user_memories_identities_user_id_index').on(table.userId),
    index('user_memories_identities_user_memory_id_index').on(table.userMemoryId),
    index('user_memories_identities_entity_id_index').on(table.entityId),
  ],
);

export const userMemoriesExperiences = pgTable(
  'user_memories_experiences',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    userMemoryId: varchar255('user_memory_id').references(() => userMemories.id, {
      onDelete: 'cascade',
    }),

    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    tags: text('tags').array(),

    type: varchar255('type'),
    situation: text('situation'),
    situationVector: vector('situation_vector', { dimensions: 1024 }),
    reasoning: text('reasoning'),
    possibleOutcome: text('possible_outcome'),
    action: text('action'),
    actionVector: vector('action_vector', { dimensions: 1024 }),
    keyLearning: text('key_learning'),
    keyLearningVector: vector('key_learning_vector', { dimensions: 1024 }),

    scoreConfidence: real('score_confidence').default(0),

    capturedAt: timestamptz('captured_at').notNull().defaultNow(),

    ...timestamps,
  },
  (table) => [
    index('user_memories_experiences_situation_vector_index').using(
      'hnsw',
      table.situationVector.op('vector_cosine_ops'),
    ),
    index('user_memories_experiences_action_vector_index').using(
      'hnsw',
      table.actionVector.op('vector_cosine_ops'),
    ),
    index('user_memories_experiences_key_learning_vector_index').using(
      'hnsw',
      table.keyLearningVector.op('vector_cosine_ops'),
    ),
    index('user_memories_experiences_type_index').on(table.type),
    index('user_memories_experiences_user_id_index').on(table.userId),
    index('user_memories_experiences_user_memory_id_index').on(table.userMemoryId),
  ],
);

/** Contexts and projects are many-to-many: one situation can span several projects. */
export const userMemoriesContextProjects = pgTable(
  'user_memories_context_projects',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    contextId: varchar255('context_id')
      .references(() => userMemoriesContexts.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: text('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    source: text('source').$type<UserMemoryContextProjectSource>().notNull(),
    /** Dossiers in the context whose evidence came from this project; orders injection. */
    evidenceCount: integer('evidence_count').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('user_memories_context_projects_context_id_project_id_unique').on(
      table.contextId,
      table.projectId,
    ),
    index('user_memories_context_projects_project_id_index').on(table.projectId),
    index('user_memories_context_projects_user_id_index').on(table.userId),
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

/**
 * Every structural change the pipeline, the user or an agent makes to memory, with enough state to
 * undo it. Pending rows are the review queue: held for more evidence or waiting for the user.
 */
export const userMemoriesOperations = pgTable(
  'user_memories_operations',
  {
    id: varchar255('id')
      .$defaultFn(() => idGenerator('memory'))
      .primaryKey(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    op: text('op').$type<UserMemoryOperationType>().notNull(),
    actor: text('actor').$type<UserMemoryOperationActor>().notNull(),
    /** Ids the operation touches, keyed by role (e.g. `{ dossier, activity }`). */
    targets: jsonb('targets').$type<Record<string, string | string[]>>().notNull(),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    confidence: real('confidence'),
    reason: text('reason'),
    gate: text('gate').$type<UserMemoryOperationGate>().notNull(),
    state: text('state').$type<UserMemoryOperationState>().notNull(),
    resolvedAt: timestamptz('resolved_at'),

    ...timestamps,
  },
  (table) => [
    index('user_memories_operations_user_id_state_created_at_index').on(
      table.userId,
      table.state,
      table.createdAt,
    ),
  ],
);

export type UserMemoryItem = typeof userMemories.$inferSelect;
export type UserMemoryItemWithoutVectors = Omit<
  UserMemoryItem,
  'summaryVector1024' | 'detailsVector1024'
>;
export type NewUserMemory = typeof userMemories.$inferInsert;

export type UserMemoryPreference = typeof userMemoriesPreferences.$inferSelect;
export type UserMemoryPreferencesWithoutVectors = Omit<
  UserMemoryPreference,
  'conclusionDirectivesVector'
>;
export type NewUserMemoryPreference = typeof userMemoriesPreferences.$inferInsert;

export type UserMemoryContext = typeof userMemoriesContexts.$inferSelect;
export type UserMemoryContextsWithoutVectors = Omit<
  UserMemoryContext,
  'titleVector' | 'descriptionVector'
>;
export type NewUserMemoryContext = typeof userMemoriesContexts.$inferInsert;

export type UserMemoryIdentity = typeof userMemoriesIdentities.$inferSelect;
export type UserMemoryIdentitiesWithoutVectors = Omit<UserMemoryIdentity, 'descriptionVector'>;
export type NewUserMemoryIdentity = typeof userMemoriesIdentities.$inferInsert;

export type UserMemoryExperience = typeof userMemoriesExperiences.$inferSelect;
export type UserMemoryExperiencesWithoutVectors = Omit<
  UserMemoryExperience,
  'situationVector' | 'actionVector' | 'keyLearningVector'
>;
export type NewUserMemoryExperience = typeof userMemoriesExperiences.$inferInsert;

export type UserMemoryActivity = typeof userMemoriesActivities.$inferSelect;
export type UserMemoryActivitiesWithoutVectors = Omit<
  UserMemoryActivity,
  'narrativeVector' | 'feedbackVector'
>;
export type NewUserMemoryActivity = typeof userMemoriesActivities.$inferInsert;

export type UserMemoryDossier = typeof userMemoriesDossiers.$inferSelect;
export type NewUserMemoryDossier = typeof userMemoriesDossiers.$inferInsert;

export type UserMemoryEntity = typeof userMemoriesEntities.$inferSelect;
export type NewUserMemoryEntity = typeof userMemoriesEntities.$inferInsert;
export type UserMemoryEntityName = typeof userMemoriesEntityNames.$inferSelect;
export type NewUserMemoryEntityName = typeof userMemoriesEntityNames.$inferInsert;

export type UserMemoryContextProject = typeof userMemoriesContextProjects.$inferSelect;
export type NewUserMemoryContextProject = typeof userMemoriesContextProjects.$inferInsert;

export type UserMemoryOperation = typeof userMemoriesOperations.$inferSelect;
export type NewUserMemoryOperation = typeof userMemoriesOperations.$inferInsert;

export * from './persona';
