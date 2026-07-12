CREATE TABLE "script_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"script_version_id" integer NOT NULL,
	"platform" text NOT NULL,
	"hook_rate" real,
	"ctr" real,
	"cpa" real,
	"impressions" integer,
	"notes" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "script_metrics" ADD CONSTRAINT "script_metrics_script_version_id_script_versions_id_fk" FOREIGN KEY ("script_version_id") REFERENCES "public"."script_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "script_metrics_version_platform_uq" ON "script_metrics" USING btree ("script_version_id","platform");