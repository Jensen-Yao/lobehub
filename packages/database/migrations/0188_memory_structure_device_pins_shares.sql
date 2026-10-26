-- Structured user memory (context -> dossier -> activity, entities with names, context <-> project
-- links, operation log), per-device agent account pins, and goal/file share links.
-- Every change to an existing table is additive and nullable (or has a constant default).
-- Foreign keys on the existing large memory tables are NOT VALID: the new columns are all NULL, so
-- validation would only scan the table under lock. Run VALIDATE CONSTRAINT later if wanted.
CREATE TABLE IF NOT EXISTS "agent_account_device_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"device_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "file_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"page_view_count" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goal_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_id" text NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text,
	"page_view_count" integer DEFAULT 0 NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memories_context_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context_id" varchar(255) NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text,
	"metadata" jsonb,
	"source" text NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memories_dossiers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"context_id" varchar(255),
	"user_id" text,
	"user_memory_id" varchar(255),
	"metadata" jsonb,
	"title" text,
	"summary" text,
	"summary_vector" vector(1024),
	"now" text,
	"decisions" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_at" timestamp with time zone,
	"last_evidence_at" timestamp with time zone,
	"activity_count" integer DEFAULT 0 NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memories_entities" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"parent_entity_id" varchar(255),
	"user_id" text,
	"metadata" jsonb,
	"name" text NOT NULL,
	"type" text DEFAULT 'other' NOT NULL,
	"relationship" text,
	"role" text,
	"description" text,
	"description_vector" vector(1024),
	"is_self" boolean DEFAULT false NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memories_entity_distinctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"metadata" jsonb,
	"name_a" text NOT NULL,
	"name_b" text NOT NULL,
	"source_memory_id" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memories_entity_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_memory_id" varchar(255) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"user_id" text,
	"metadata" jsonb,
	"role" text DEFAULT 'mention' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memories_entity_names" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"user_id" text,
	"metadata" jsonb,
	"name" text NOT NULL,
	"normalized" text NOT NULL,
	"kind" text DEFAULT 'alias' NOT NULL,
	"source_memory_id" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memories_operations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"metadata" jsonb,
	"op" text NOT NULL,
	"actor" text NOT NULL,
	"targets" jsonb NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"confidence" real,
	"reason" text,
	"gate" text NOT NULL,
	"state" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_memories" ADD COLUMN IF NOT EXISTS "state" text;--> statement-breakpoint
ALTER TABLE "user_memories" ADD COLUMN IF NOT EXISTS "user_locked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_memories" ADD COLUMN IF NOT EXISTS "topic_id" text;--> statement-breakpoint
ALTER TABLE "user_memories" ADD COLUMN IF NOT EXISTS "message_ids" jsonb;--> statement-breakpoint
ALTER TABLE "user_memories_activities" ADD COLUMN IF NOT EXISTS "dossier_id" varchar(255);--> statement-breakpoint
ALTER TABLE "user_memories_activities" ADD COLUMN IF NOT EXISTS "topic_id" text;--> statement-breakpoint
ALTER TABLE "user_memories_activities" ADD COLUMN IF NOT EXISTS "message_ids" jsonb;--> statement-breakpoint
ALTER TABLE "user_memories_activities" ADD COLUMN IF NOT EXISTS "project_id" text;--> statement-breakpoint
ALTER TABLE "user_memories_activities" ADD COLUMN IF NOT EXISTS "injectable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_memories_contexts" ADD COLUMN IF NOT EXISTS "user_memory_id" varchar(255);--> statement-breakpoint
ALTER TABLE "user_memories_contexts" ADD COLUMN IF NOT EXISTS "now" text;--> statement-breakpoint
ALTER TABLE "user_memories_contexts" ADD COLUMN IF NOT EXISTS "next_steps" jsonb;--> statement-breakpoint
ALTER TABLE "user_memories_contexts" ADD COLUMN IF NOT EXISTS "open_questions" jsonb;--> statement-breakpoint
ALTER TABLE "user_memories_contexts" ADD COLUMN IF NOT EXISTS "first_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_memories_contexts" ADD COLUMN IF NOT EXISTS "last_evidence_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_memories_contexts" ADD COLUMN IF NOT EXISTS "synthesized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_memories_identities" ADD COLUMN IF NOT EXISTS "entity_id" varchar(255);--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD COLUMN IF NOT EXISTS "holder_entity_id" varchar(255);--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD COLUMN IF NOT EXISTS "applies_to_entity_id" varchar(255);--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD COLUMN IF NOT EXISTS "scope" text;--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD COLUMN IF NOT EXISTS "evidence_source" text;--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD COLUMN IF NOT EXISTS "evidence_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD COLUMN IF NOT EXISTS "last_evidence_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" DROP CONSTRAINT IF EXISTS "agent_account_device_pins_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" ADD CONSTRAINT "agent_account_device_pins_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" DROP CONSTRAINT IF EXISTS "agent_account_device_pins_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" ADD CONSTRAINT "agent_account_device_pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" DROP CONSTRAINT IF EXISTS "agent_account_device_pins_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" ADD CONSTRAINT "agent_account_device_pins_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" DROP CONSTRAINT IF EXISTS "agent_account_device_pins_device_id_devices_id_fk";--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" ADD CONSTRAINT "agent_account_device_pins_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" DROP CONSTRAINT IF EXISTS "agent_account_device_pins_account_id_agent_provider_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "agent_account_device_pins" ADD CONSTRAINT "agent_account_device_pins_account_id_agent_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."agent_provider_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" DROP CONSTRAINT IF EXISTS "file_shares_file_id_files_id_fk";--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" DROP CONSTRAINT IF EXISTS "file_shares_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" DROP CONSTRAINT IF EXISTS "file_shares_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_shares" DROP CONSTRAINT IF EXISTS "goal_shares_goal_id_goals_id_fk";--> statement-breakpoint
ALTER TABLE "goal_shares" ADD CONSTRAINT "goal_shares_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_shares" DROP CONSTRAINT IF EXISTS "goal_shares_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "goal_shares" ADD CONSTRAINT "goal_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_shares" DROP CONSTRAINT IF EXISTS "goal_shares_workspace_id_workspaces_id_fk";--> statement-breakpoint
ALTER TABLE "goal_shares" ADD CONSTRAINT "goal_shares_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_context_projects" DROP CONSTRAINT IF EXISTS "user_memories_context_projects_context_id_user_memories_contexts_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_context_projects" ADD CONSTRAINT "user_memories_context_projects_context_id_user_memories_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."user_memories_contexts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_context_projects" DROP CONSTRAINT IF EXISTS "user_memories_context_projects_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_context_projects" ADD CONSTRAINT "user_memories_context_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_context_projects" DROP CONSTRAINT IF EXISTS "user_memories_context_projects_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_context_projects" ADD CONSTRAINT "user_memories_context_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_dossiers" DROP CONSTRAINT IF EXISTS "user_memories_dossiers_context_id_user_memories_contexts_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_dossiers" ADD CONSTRAINT "user_memories_dossiers_context_id_user_memories_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."user_memories_contexts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_dossiers" DROP CONSTRAINT IF EXISTS "user_memories_dossiers_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_dossiers" ADD CONSTRAINT "user_memories_dossiers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_dossiers" DROP CONSTRAINT IF EXISTS "user_memories_dossiers_user_memory_id_user_memories_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_dossiers" ADD CONSTRAINT "user_memories_dossiers_user_memory_id_user_memories_id_fk" FOREIGN KEY ("user_memory_id") REFERENCES "public"."user_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entities" DROP CONSTRAINT IF EXISTS "user_memories_entities_parent_entity_id_user_memories_entities_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entities" ADD CONSTRAINT "user_memories_entities_parent_entity_id_user_memories_entities_id_fk" FOREIGN KEY ("parent_entity_id") REFERENCES "public"."user_memories_entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entities" DROP CONSTRAINT IF EXISTS "user_memories_entities_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entities" ADD CONSTRAINT "user_memories_entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entity_distinctions" DROP CONSTRAINT IF EXISTS "user_memories_entity_distinctions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entity_distinctions" ADD CONSTRAINT "user_memories_entity_distinctions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entity_distinctions" DROP CONSTRAINT IF EXISTS "user_memories_entity_distinctions_source_memory_id_user_memories_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entity_distinctions" ADD CONSTRAINT "user_memories_entity_distinctions_source_memory_id_user_memories_id_fk" FOREIGN KEY ("source_memory_id") REFERENCES "public"."user_memories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entity_mentions" DROP CONSTRAINT IF EXISTS "user_memories_entity_mentions_user_memory_id_user_memories_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entity_mentions" ADD CONSTRAINT "user_memories_entity_mentions_user_memory_id_user_memories_id_fk" FOREIGN KEY ("user_memory_id") REFERENCES "public"."user_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entity_mentions" DROP CONSTRAINT IF EXISTS "user_memories_entity_mentions_entity_id_user_memories_entities_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entity_mentions" ADD CONSTRAINT "user_memories_entity_mentions_entity_id_user_memories_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."user_memories_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entity_mentions" DROP CONSTRAINT IF EXISTS "user_memories_entity_mentions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entity_mentions" ADD CONSTRAINT "user_memories_entity_mentions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entity_names" DROP CONSTRAINT IF EXISTS "user_memories_entity_names_entity_id_user_memories_entities_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entity_names" ADD CONSTRAINT "user_memories_entity_names_entity_id_user_memories_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."user_memories_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entity_names" DROP CONSTRAINT IF EXISTS "user_memories_entity_names_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entity_names" ADD CONSTRAINT "user_memories_entity_names_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_entity_names" DROP CONSTRAINT IF EXISTS "user_memories_entity_names_source_memory_id_user_memories_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_entity_names" ADD CONSTRAINT "user_memories_entity_names_source_memory_id_user_memories_id_fk" FOREIGN KEY ("source_memory_id") REFERENCES "public"."user_memories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_operations" DROP CONSTRAINT IF EXISTS "user_memories_operations_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_operations" ADD CONSTRAINT "user_memories_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_account_device_pins_agent_device_unique" ON "agent_account_device_pins" USING btree ("agent_id","device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_account_device_pins_device_id_idx" ON "agent_account_device_pins" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_account_device_pins_account_id_idx" ON "agent_account_device_pins" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_account_device_pins_user_id_idx" ON "agent_account_device_pins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_account_device_pins_workspace_id_idx" ON "agent_account_device_pins" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "file_shares_file_id_unique" ON "file_shares" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_shares_user_id_idx" ON "file_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_shares_workspace_id_idx" ON "file_shares" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "goal_shares_goal_id_unique" ON "goal_shares" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goal_shares_user_id_idx" ON "goal_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goal_shares_workspace_id_idx" ON "goal_shares" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_memories_context_projects_context_id_project_id_unique" ON "user_memories_context_projects" USING btree ("context_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_context_projects_project_id_index" ON "user_memories_context_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_context_projects_user_id_index" ON "user_memories_context_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_dossiers_summary_vector_index" ON "user_memories_dossiers" USING hnsw ("summary_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_dossiers_context_id_index" ON "user_memories_dossiers" USING btree ("context_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_dossiers_user_id_last_evidence_at_index" ON "user_memories_dossiers" USING btree ("user_id","last_evidence_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_dossiers_user_memory_id_index" ON "user_memories_dossiers" USING btree ("user_memory_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_entities_description_vector_index" ON "user_memories_entities" USING hnsw ("description_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_entities_user_id_index" ON "user_memories_entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_entities_parent_entity_id_index" ON "user_memories_entities" USING btree ("parent_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_memories_entities_user_id_self_unique" ON "user_memories_entities" USING btree ("user_id") WHERE "user_memories_entities"."is_self";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_memories_entity_distinctions_user_id_names_unique" ON "user_memories_entity_distinctions" USING btree ("user_id","name_a","name_b");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_memories_entity_mentions_memory_entity_role_unique" ON "user_memories_entity_mentions" USING btree ("user_memory_id","entity_id","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_entity_mentions_entity_id_index" ON "user_memories_entity_mentions" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_memories_entity_names_entity_id_normalized_unique" ON "user_memories_entity_names" USING btree ("entity_id","normalized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_entity_names_user_id_normalized_index" ON "user_memories_entity_names" USING btree ("user_id","normalized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_operations_user_id_state_created_at_index" ON "user_memories_operations" USING btree ("user_id","state","created_at");--> statement-breakpoint
ALTER TABLE "user_memories_activities" DROP CONSTRAINT IF EXISTS "user_memories_activities_dossier_id_user_memories_dossiers_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_activities" ADD CONSTRAINT "user_memories_activities_dossier_id_user_memories_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."user_memories_dossiers"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "user_memories_contexts" DROP CONSTRAINT IF EXISTS "user_memories_contexts_user_memory_id_user_memories_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_contexts" ADD CONSTRAINT "user_memories_contexts_user_memory_id_user_memories_id_fk" FOREIGN KEY ("user_memory_id") REFERENCES "public"."user_memories"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "user_memories_identities" DROP CONSTRAINT IF EXISTS "user_memories_identities_entity_id_user_memories_entities_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_identities" ADD CONSTRAINT "user_memories_identities_entity_id_user_memories_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."user_memories_entities"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "user_memories_preferences" DROP CONSTRAINT IF EXISTS "user_memories_preferences_holder_entity_id_user_memories_entities_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD CONSTRAINT "user_memories_preferences_holder_entity_id_user_memories_entities_id_fk" FOREIGN KEY ("holder_entity_id") REFERENCES "public"."user_memories_entities"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "user_memories_preferences" DROP CONSTRAINT IF EXISTS "user_memories_preferences_applies_to_entity_id_user_memories_entities_id_fk";--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD CONSTRAINT "user_memories_preferences_applies_to_entity_id_user_memories_entities_id_fk" FOREIGN KEY ("applies_to_entity_id") REFERENCES "public"."user_memories_entities"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_topic_id_index" ON "user_memories" USING btree ("topic_id") WHERE "user_memories"."topic_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_activities_dossier_id_index" ON "user_memories_activities" USING btree ("dossier_id") WHERE "user_memories_activities"."dossier_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_contexts_user_memory_id_index" ON "user_memories_contexts" USING btree ("user_memory_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_contexts_user_id_last_evidence_at_index" ON "user_memories_contexts" USING btree ("user_id","last_evidence_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_identities_entity_id_index" ON "user_memories_identities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_preferences_holder_entity_id_index" ON "user_memories_preferences" USING btree ("holder_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_memories_preferences_applies_to_entity_id_index" ON "user_memories_preferences" USING btree ("applies_to_entity_id");