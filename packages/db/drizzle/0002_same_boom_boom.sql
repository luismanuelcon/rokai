ALTER TABLE "rentals" ADD COLUMN "signature" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "terms_version" text DEFAULT '' NOT NULL;