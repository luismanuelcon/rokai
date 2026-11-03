CREATE TABLE "rental_tracking" (
	"rental_id" bigint PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "rental_tracking" ADD CONSTRAINT "rental_tracking_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rental_tracking_token_unique" ON "rental_tracking" USING btree ("token");