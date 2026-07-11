CREATE TABLE "script_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"script_version_id" integer NOT NULL,
	"score" integer NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"format" text DEFAULT 'vsl' NOT NULL,
	"framework_id" integer,
	"description" text,
	"brief_defaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_md" text NOT NULL,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "source_script_id" integer;--> statement-breakpoint
ALTER TABLE "frameworks" ADD COLUMN "format" text DEFAULT 'vsl' NOT NULL;--> statement-breakpoint
ALTER TABLE "script_versions" ADD COLUMN "source" text DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "script_versions" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "format" text DEFAULT 'vsl' NOT NULL;--> statement-breakpoint
ALTER TABLE "script_ratings" ADD CONSTRAINT "script_ratings_script_version_id_script_versions_id_fk" FOREIGN KEY ("script_version_id") REFERENCES "public"."script_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_framework_id_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."frameworks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "script_ratings_version_uq" ON "script_ratings" USING btree ("script_version_id");--> statement-breakpoint
CREATE INDEX "templates_format_idx" ON "templates" USING btree ("format");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_script_id_scripts_id_fk" FOREIGN KEY ("source_script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;