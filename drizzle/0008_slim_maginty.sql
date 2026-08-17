ALTER TABLE "documents" ADD COLUMN "industry_slug" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "format" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "industry_learnings" ADD COLUMN "industry_slug" text;--> statement-breakpoint
ALTER TABLE "industry_learnings" ADD COLUMN "subindustry_slug" text;--> statement-breakpoint
CREATE INDEX "documents_industry_idx" ON "documents" USING btree ("industry_slug","kind","is_active");--> statement-breakpoint
CREATE INDEX "documents_content_hash_idx" ON "documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "industry_learnings_slug_idx" ON "industry_learnings" USING btree ("industry_slug","is_active");