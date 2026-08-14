const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    // Create enums (IF NOT EXISTS)
    await client.query(`DO $$ BEGIN CREATE TYPE "public"."activity_type" AS ENUM('login', 'logout', 'order_created', 'order_updated', 'settlement', 'invoice_uploaded', 'customer_added', 'product_added'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'delivered', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'partial', 'settled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'salesperson'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    console.log('✓ Enums created');

    // Create users table
    await client.query(`CREATE TABLE IF NOT EXISTS "users" (
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
    );`);
    console.log('✓ users table');

    // Create customers table
    await client.query(`CREATE TABLE IF NOT EXISTS "customers" (
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
      "assigned_salesperson_id" integer REFERENCES "users"("id"),
      "is_active" boolean DEFAULT true,
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now()
    );`);
    console.log('✓ customers table');

    // Create products table
    await client.query(`CREATE TABLE IF NOT EXISTS "products" (
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
    );`);
    console.log('✓ products table');

    // Create orders table
    await client.query(`CREATE TABLE IF NOT EXISTS "orders" (
      "id" serial PRIMARY KEY NOT NULL,
      "invoice_number" varchar(50),
      "customer_id" integer NOT NULL REFERENCES "customers"("id"),
      "salesperson_id" integer NOT NULL REFERENCES "users"("id"),
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
    );`);
    console.log('✓ orders table');

    // Create order_items table
    await client.query(`CREATE TABLE IF NOT EXISTS "order_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "order_id" integer NOT NULL REFERENCES "orders"("id"),
      "product_id" integer REFERENCES "products"("id"),
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
    );`);
    console.log('✓ order_items table');

    // Create settlements table
    await client.query(`CREATE TABLE IF NOT EXISTS "settlements" (
      "id" serial PRIMARY KEY NOT NULL,
      "order_id" integer NOT NULL REFERENCES "orders"("id"),
      "customer_id" integer NOT NULL REFERENCES "customers"("id"),
      "salesperson_id" integer NOT NULL REFERENCES "users"("id"),
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
    );`);
    console.log('✓ settlements table');

    // Create invoices table
    await client.query(`CREATE TABLE IF NOT EXISTS "invoices" (
      "id" serial PRIMARY KEY NOT NULL,
      "file_name" varchar(255) NOT NULL,
      "file_type" varchar(50),
      "file_size" integer,
      "extracted_data" jsonb,
      "validation_result" jsonb,
      "imported_order_id" integer REFERENCES "orders"("id"),
      "uploaded_by_id" integer REFERENCES "users"("id"),
      "status" varchar(20) DEFAULT 'uploaded',
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now()
    );`);
    console.log('✓ invoices table');

    // Create activity_logs table
    await client.query(`CREATE TABLE IF NOT EXISTS "activity_logs" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer REFERENCES "users"("id"),
      "activity_type" "activity_type" NOT NULL,
      "entity_type" varchar(50),
      "entity_id" integer,
      "description" text NOT NULL,
      "metadata" jsonb,
      "ip_address" varchar(45),
      "created_at" timestamp DEFAULT now()
    );`);
    console.log('✓ activity_logs table');

    // Create sessions table
    await client.query(`CREATE TABLE IF NOT EXISTS "sessions" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL REFERENCES "users"("id"),
      "token" varchar(500) NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now(),
      CONSTRAINT "sessions_token_unique" UNIQUE("token")
    );`);
    console.log('✓ sessions table');

    console.log('\\n✅ All 9 tables created successfully!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
