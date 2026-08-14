CREATE TYPE "public"."activity_type" AS ENUM('login', 'logout', 'order_created', 'order_updated', 'settlement', 'invoice_uploaded', 'customer_added', 'product_added');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'partial', 'settled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'salesperson');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"activity_type" "activity_type" NOT NULL,
	"entity_type" varchar(50),
	"entity_id" integer,
	"description" text NOT NULL,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"gstin" varchar(15),
	"pan" varchar(10),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(6),
	"beat" varchar(100),
	"credit_limit" numeric(12, 2) DEFAULT '0',
	"outstanding_balance" numeric(12, 2) DEFAULT '0',
	"assigned_salesperson_id" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"extracted_data" jsonb,
	"validation_result" jsonb,
	"imported_order_id" integer,
	"uploaded_by_id" integer,
	"status" varchar(20) DEFAULT 'uploaded',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"erp_id" varchar(50),
	"product_name" varchar(255) NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"short_quantity" numeric(10, 2) DEFAULT '0',
	"return_quantity" numeric(10, 2) DEFAULT '0',
	"return_reason" text,
	"unit" varchar(20) DEFAULT 'PCS',
	"unit_price" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0',
	"taxable_amount" numeric(12, 2) DEFAULT '0',
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"gst_amount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" varchar(50),
	"customer_id" integer NOT NULL,
	"salesperson_id" integer NOT NULL,
	"order_date" timestamp DEFAULT now(),
	"delivery_date" timestamp,
	"status" "order_status" DEFAULT 'pending',
	"subtotal" numeric(12, 2) DEFAULT '0',
	"taxable_amount" numeric(12, 2) DEFAULT '0',
	"cgst" numeric(10, 2) DEFAULT '0',
	"sgst" numeric(10, 2) DEFAULT '0',
	"igst" numeric(10, 2) DEFAULT '0',
	"total_gst" numeric(10, 2) DEFAULT '0',
	"grand_total" numeric(12, 2) DEFAULT '0',
	"amount_paid" numeric(12, 2) DEFAULT '0',
	"balance" numeric(12, 2) DEFAULT '0',
	"settlement_status" "settlement_status" DEFAULT 'pending',
	"beat" varchar(100),
	"notes" text,
	"credit_days" integer DEFAULT 0,
	"due_date" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "orders_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"erp_id" varchar(50),
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"unit" varchar(20) DEFAULT 'PCS',
	"mrp" numeric(10, 2),
	"base_price" numeric(10, 2) NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"hsn_code" varchar(10),
	"stock_qty" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_erp_id_unique" UNIQUE("erp_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(500) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"salesperson_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"cash_amount" numeric(12, 2) DEFAULT '0',
	"online_amount" numeric(12, 2) DEFAULT '0',
	"payment_mode" varchar(50) NOT NULL,
	"denominations" jsonb,
	"clearing_days" integer,
	"reference_number" varchar(100),
	"notes" text,
	"settled_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'salesperson' NOT NULL,
	"phone" varchar(20),
	"avatar" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_salesperson_id_users_id_fk" FOREIGN KEY ("assigned_salesperson_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_imported_order_id_orders_id_fk" FOREIGN KEY ("imported_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_salesperson_id_users_id_fk" FOREIGN KEY ("salesperson_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_salesperson_id_users_id_fk" FOREIGN KEY ("salesperson_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;