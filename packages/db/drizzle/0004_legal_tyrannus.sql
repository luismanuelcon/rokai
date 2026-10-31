CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer');--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "payment_method" "payment_method";