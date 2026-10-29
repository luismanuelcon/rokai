CREATE TYPE "public"."document_type" AS ENUM('CC', 'CE', 'TI', 'PA', 'PEP', 'PPT');--> statement-breakpoint
DROP INDEX "customers_document_key";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "document_type" "document_type" DEFAULT 'CC' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_document_key" ON "customers" USING btree ("document_type","document");