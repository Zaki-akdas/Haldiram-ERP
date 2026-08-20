CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) DEFAULT '',
	"tagline" varchar(255) DEFAULT '',
	"gstin" varchar(15) DEFAULT '',
	"address" text DEFAULT '',
	"phone" varchar(20) DEFAULT '',
	"email" varchar(255) DEFAULT '',
	"bank_name" varchar(255) DEFAULT '',
	"bank_account" varchar(50) DEFAULT '',
	"bank_ifsc" varchar(20) DEFAULT '',
	"bank_branch" varchar(255) DEFAULT '',
	"logo_url" text DEFAULT '',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "short_quantity" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "return_quantity" SET DATA TYPE integer;