CREATE TABLE "day_closings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"opens_at" text NOT NULL,
	"closes_at" text NOT NULL,
	"closes_next_day" boolean DEFAULT false NOT NULL,
	"cash_cents" integer NOT NULL,
	"transfer_cents" integer NOT NULL,
	"expenses" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" bigint,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_closings_amounts_nonnegative" CHECK ("day_closings"."cash_cents" >= 0 AND "day_closings"."transfer_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "day_closings" ADD CONSTRAINT "day_closings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_closings" ADD CONSTRAINT "day_closings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "day_closings_date_unique" ON "day_closings" USING btree ("date");