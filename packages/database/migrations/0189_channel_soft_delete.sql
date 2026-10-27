-- Channels join the shared recycle bin: replace the channel-local `archived` flag with the
-- standard `is_deleted` / `deleted_at` pair. A channel already removed keeps its deleted state.
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "is_deleted" boolean;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'channels' AND column_name = 'archived'
  ) THEN
    UPDATE "channels" SET "is_deleted" = true, "deleted_at" = "updated_at" WHERE "archived" = true;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "channels" DROP COLUMN IF EXISTS "archived";
