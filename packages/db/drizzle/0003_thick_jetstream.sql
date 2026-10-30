ALTER TABLE "rentals" ADD COLUMN "late_minutes" integer;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "late_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_late_fee_chk" CHECK ("rentals"."late_fee_cents" IS NULL OR "rentals"."late_fee_cents" >= 0);--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_late_minutes_chk" CHECK ("rentals"."late_minutes" IS NULL OR "rentals"."late_minutes" >= 0);