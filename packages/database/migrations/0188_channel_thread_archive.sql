ALTER TABLE "channel_threads" ADD COLUMN IF NOT EXISTS "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "channel_threads_root_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channel_threads_root_unique" ON "channel_threads" USING btree ("channel_id","root_message_id") WHERE "channel_threads"."archived" = false;