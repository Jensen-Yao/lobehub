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
CREATE UNIQUE INDEX IF NOT EXISTS "agent_account_device_pins_agent_device_unique" ON "agent_account_device_pins" USING btree ("agent_id","device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_account_device_pins_device_id_idx" ON "agent_account_device_pins" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_account_device_pins_account_id_idx" ON "agent_account_device_pins" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_account_device_pins_user_id_idx" ON "agent_account_device_pins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_account_device_pins_workspace_id_idx" ON "agent_account_device_pins" USING btree ("workspace_id");
