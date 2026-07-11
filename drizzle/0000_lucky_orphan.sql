CREATE TABLE "asset_extractions" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"provider" text,
	"model" text,
	"status" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"industry" text,
	"subindustry" text,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"offer_id" integer NOT NULL,
	"title" text NOT NULL,
	"objective" text,
	"brief" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"industry" text,
	"description" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "critiques" (
	"id" serial PRIMARY KEY NOT NULL,
	"script_version_id" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"brand_id" integer,
	"offer_id" integer,
	"campaign_id" integer,
	"intake_request_id" uuid,
	"source_asset_id" uuid,
	"visibility" text DEFAULT 'private' NOT NULL,
	"industry" text,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"filename" text,
	"mime_type" text,
	"file_path" text,
	"extracted_text" text DEFAULT '' NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"intake_request_id" uuid,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_id" text,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frameworks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"structure_md" text NOT NULL,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frameworks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hook_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"script_id" integer NOT NULL,
	"hooks" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industry_learnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"industry" text NOT NULL,
	"subindustry" text,
	"content" text NOT NULL,
	"evidence_count" integer DEFAULT 1 NOT NULL,
	"source_script_id" integer,
	"is_active" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"client_id" integer,
	"brand_id" integer,
	"offer_id" integer,
	"campaign_id" integer,
	"title" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"review_started_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completion" integer DEFAULT 0 NOT NULL,
	"summary" jsonb,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'service' NOT NULL,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"script_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"content" text NOT NULL,
	"generation_params" jsonb NOT NULL,
	"refinement_instruction" text,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"brand_id" integer,
	"offer_id" integer,
	"campaign_id" integer,
	"framework_id" integer,
	"title" text NOT NULL,
	"brief" jsonb NOT NULL,
	"provider" text DEFAULT 'anthropic' NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"outcome" text DEFAULT 'unknown' NOT NULL,
	"outcome_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intake_request_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"source_url" text,
	"storage_path" text,
	"mime_type" text,
	"size_bytes" integer,
	"status" text DEFAULT 'queued' NOT NULL,
	"extracted_text" text DEFAULT '' NOT NULL,
	"extraction_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_extractions" ADD CONSTRAINT "asset_extractions_asset_id_source_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."source_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critiques" ADD CONSTRAINT "critiques_script_version_id_script_versions_id_fk" FOREIGN KEY ("script_version_id") REFERENCES "public"."script_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_intake_request_id_intake_requests_id_fk" FOREIGN KEY ("intake_request_id") REFERENCES "public"."intake_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_asset_id_source_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."source_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_intake_request_id_intake_requests_id_fk" FOREIGN KEY ("intake_request_id") REFERENCES "public"."intake_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hook_sets" ADD CONSTRAINT "hook_sets_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "industry_learnings" ADD CONSTRAINT "industry_learnings_source_script_id_scripts_id_fk" FOREIGN KEY ("source_script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_requests" ADD CONSTRAINT "intake_requests_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_request_id_intake_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."intake_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_framework_id_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."frameworks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_assets" ADD CONSTRAINT "source_assets_intake_request_id_intake_requests_id_fk" FOREIGN KEY ("intake_request_id") REFERENCES "public"."intake_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_extractions_asset_idx" ON "asset_extractions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "brands_client_idx" ON "brands" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "campaigns_offer_idx" ON "campaigns" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "documents_client_idx" ON "documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "documents_brand_idx" ON "documents" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "documents_visibility_idx" ON "documents" USING btree ("visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_idempotency_uq" ON "email_deliveries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "industry_learnings_scope_idx" ON "industry_learnings" USING btree ("industry","subindustry");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_requests_public_id_uq" ON "intake_requests" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_requests_token_hash_uq" ON "intake_requests" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "intake_requests_status_idx" ON "intake_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "intake_requests_client_idx" ON "intake_requests" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_submissions_request_uq" ON "intake_submissions" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "login_attempts_fingerprint_idx" ON "login_attempts" USING btree ("fingerprint","attempted_at");--> statement-breakpoint
CREATE INDEX "offers_brand_idx" ON "offers" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "script_versions_number_uq" ON "script_versions" USING btree ("script_id","version_number");--> statement-breakpoint
CREATE INDEX "scripts_client_idx" ON "scripts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "source_assets_intake_idx" ON "source_assets" USING btree ("intake_request_id");
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intake_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intake_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_extractions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "frameworks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scripts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "script_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hook_sets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "critiques" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "industry_learnings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'intake-assets',
  'intake-assets',
  false,
  26214400,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
