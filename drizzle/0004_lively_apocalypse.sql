ALTER TABLE "scripts" ADD COLUMN "generation_error" text;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "generation_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "generation_heartbeat_at" timestamp with time zone;