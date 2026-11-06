CREATE TYPE "public"."reservation_status" AS ENUM('confirmed', 'cancelled', 'in_rental', 'completed', 'no_show');--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"request_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"service_date" date NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"quantity" smallint NOT NULL,
	"rate_id" bigint,
	"rate_period" "rate_period" NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"plan_label" text NOT NULL,
	"status" "reservation_status" DEFAULT 'confirmed' NOT NULL,
	"status_reason" text,
	"status_changed_at" timestamp with time zone,
	"status_changed_by" bigint,
	"rental_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_quantity_chk" CHECK ("reservations"."quantity" BETWEEN 1 AND 2),
	CONSTRAINT "reservations_interval_chk" CHECK ("reservations"."ends_at" > "reservations"."starts_at"),
	CONSTRAINT "reservations_price_chk" CHECK ("reservations"."price_cents" >= 0),
	CONSTRAINT "reservations_phone_chk" CHECK ("reservations"."phone_e164" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_rate_id_rates_id_fk" FOREIGN KEY ("rate_id") REFERENCES "public"."rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_status_changed_by_users_id_fk" FOREIGN KEY ("status_changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_code_key" ON "reservations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_request_id_key" ON "reservations" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_rental_id_key" ON "reservations" USING btree ("rental_id");--> statement-breakpoint
CREATE INDEX "reservations_blocking_idx" ON "reservations" USING btree ("starts_at","ends_at") WHERE "reservations"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "reservations_service_date_idx" ON "reservations" USING btree ("service_date");--> statement-breakpoint
CREATE INDEX "reservations_created_at_idx" ON "reservations" USING btree ("created_at" DESC NULLS LAST);