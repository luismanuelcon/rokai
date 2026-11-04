CREATE TABLE "business_expenses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"beneficiary" text DEFAULT '' NOT NULL,
	"receipt_url" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_by" bigint,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_expenses_amount_check" CHECK ("business_expenses"."amount_cents" > 0 AND "business_expenses"."amount_cents" <= 1000000000 AND "business_expenses"."amount_cents" % 100 = 0),
	CONSTRAINT "business_expenses_category_check" CHECK ("business_expenses"."category" IN ('salary','advertising','parts','maintenance','transport','services','other'))
);
--> statement-breakpoint
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_expenses_request_unique" ON "business_expenses" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "business_expenses_date_idx" ON "business_expenses" USING btree ("date");