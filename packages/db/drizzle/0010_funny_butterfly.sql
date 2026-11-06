ALTER TYPE "public"."reservation_status" ADD VALUE 'pending' BEFORE 'confirmed';--> statement-breakpoint
DROP INDEX "reservations_blocking_idx";--> statement-breakpoint
CREATE INDEX "reservations_blocking_idx" ON "reservations" USING btree ("starts_at","ends_at") WHERE "reservations"."status" NOT IN ('cancelled', 'in_rental', 'completed', 'no_show');