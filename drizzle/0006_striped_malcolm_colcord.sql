CREATE TABLE "analysis_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"title" text DEFAULT '' NOT NULL,
	"source_url" text,
	"storage_path" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"stage" text,
	"transcript" text DEFAULT '' NOT NULL,
	"analysis" text DEFAULT '' NOT NULL,
	"document_id" integer,
	"error" text,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_jobs_status_idx" ON "analysis_jobs" USING btree ("status");