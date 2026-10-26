CREATE TYPE "public"."consent_kind" AS ENUM('operational', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."equipment_kind" AS ENUM('scooter', 'helmet');--> statement-breakpoint
CREATE TYPE "public"."equipment_status" AS ENUM('available', 'maintenance', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."notif_category" AS ENUM('utility', 'internal', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."notif_channel" AS ENUM('whatsapp', 'telegram', 'sms', 'email', 'console');--> statement-breakpoint
CREATE TYPE "public"."notif_status" AS ENUM('pending', 'sending', 'sent', 'delivered', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."rate_period" AS ENUM('special', 'weekend');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'worker', 'operator');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text DEFAULT '' NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" bigint NOT NULL,
	"kind" "consent_kind" NOT NULL,
	"granted" boolean NOT NULL,
	"channel" text DEFAULT '' NOT NULL,
	"policy_version" text DEFAULT '' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"document" text NOT NULL,
	"phone_e164" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_e164_chk" CHECK ("customers"."phone_e164" IS NULL OR "customers"."phone_e164" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"kind" "equipment_kind" NOT NULL,
	"status" "equipment_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"key" text PRIMARY KEY NOT NULL,
	"version" text DEFAULT '1' NOT NULL,
	"locale" text DEFAULT 'es-CO' NOT NULL,
	"channel" "notif_channel" NOT NULL,
	"category" "notif_category" NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"channel" "notif_channel" NOT NULL,
	"category" "notif_category" NOT NULL,
	"template_key" text NOT NULL,
	"rental_id" bigint,
	"customer_id" bigint,
	"recipient" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "notif_status" DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"period" "rate_period" NOT NULL,
	"minutes" integer NOT NULL,
	"quantity" smallint NOT NULL,
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"valid_from" date,
	"valid_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rates_minutes_chk" CHECK ("rates"."minutes" BETWEEN 1 AND 480),
	CONSTRAINT "rates_quantity_chk" CHECK ("rates"."quantity" BETWEEN 1 AND 2),
	CONSTRAINT "rates_price_chk" CHECK ("rates"."price_cents" >= 0),
	CONSTRAINT "rates_date_range_chk" CHECK ("rates"."valid_from" IS NULL OR "rates"."valid_until" IS NULL OR "rates"."valid_from" <= "rates"."valid_until")
);
--> statement-breakpoint
CREATE TABLE "rental_drafts" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_equipment" (
	"rental_id" bigint NOT NULL,
	"equipment_id" bigint NOT NULL,
	CONSTRAINT "rental_equipment_rental_id_equipment_id_pk" PRIMARY KEY("rental_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" bigint NOT NULL,
	"rate_id" bigint NOT NULL,
	"minutes" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"final_price_cents" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_by" bigint NOT NULL,
	"ended_by" bigint,
	"notes" text DEFAULT '' NOT NULL,
	"request_id" text NOT NULL,
	CONSTRAINT "rentals_price_chk" CHECK ("rentals"."price_cents" >= 0),
	CONSTRAINT "rentals_final_price_chk" CHECK ("rentals"."final_price_cents" IS NULL OR "rentals"."final_price_cents" >= 0),
	CONSTRAINT "rentals_ended_chk" CHECK ("rentals"."ended_at" IS NULL OR "rentals"."ended_at" >= "rentals"."started_at")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"csrf_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_key_message_templates_key_fk" FOREIGN KEY ("template_key") REFERENCES "public"."message_templates"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_drafts" ADD CONSTRAINT "rental_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_equipment" ADD CONSTRAINT "rental_equipment_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_equipment" ADD CONSTRAINT "rental_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_rate_id_rates_id_fk" FOREIGN KEY ("rate_id") REFERENCES "public"."rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_ended_by_users_id_fk" FOREIGN KEY ("ended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "consents_customer_kind_idx" ON "consents" USING btree ("customer_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_document_key" ON "customers" USING btree ("document");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone_e164");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment" USING btree ("code");--> statement-breakpoint
CREATE INDEX "faqs_order_idx" ON "faqs" USING btree ("position","id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idempotency_key" ON "notifications" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_dispatch_idx" ON "notifications" USING btree ("next_attempt_at") WHERE "notifications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "notifications_rental_template_idx" ON "notifications" USING btree ("rental_id","template_key");--> statement-breakpoint
CREATE INDEX "notifications_provider_msg_idx" ON "notifications" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "rates_lookup_idx" ON "rates" USING btree ("period","minutes","quantity");--> statement-breakpoint
CREATE INDEX "rental_equipment_equipment_idx" ON "rental_equipment" USING btree ("equipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rentals_request_id_key" ON "rentals" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "rentals_active_idx" ON "rentals" USING btree ("ended_at") WHERE "rentals"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "rentals_due_at_idx" ON "rentals" USING btree ("due_at") WHERE "rentals"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "rentals_customer_idx" ON "rentals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "rentals_started_at_idx" ON "rentals" USING btree ("started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));