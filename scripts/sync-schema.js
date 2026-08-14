const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function syncAllColumns() {
  const statements = [
    // users
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text;`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`,
    
    // customers
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS state varchar(100);`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS pincode varchar(6);`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`,

    // products
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS description text;`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`,

    // orders
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date timestamp;`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS taxable_amount numeric(12, 2) DEFAULT '0';`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cgst numeric(10, 2) DEFAULT '0';`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS sgst numeric(10, 2) DEFAULT '0';`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS igst numeric(10, 2) DEFAULT '0';`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS metadata jsonb;`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`,

    // order_items
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS erp_id varchar(50);`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS return_reason text;`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit varchar(20) DEFAULT 'PCS';`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount numeric(10, 2) DEFAULT '0';`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gst_rate numeric(5, 2) DEFAULT '18';`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();`,
    `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`,

    // settlements
    `ALTER TABLE settlements ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();`,
    `ALTER TABLE settlements ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`,

    // invoices
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`,

    // activity_logs
    `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_type varchar(50);`,
    `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_id integer;`,
    `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address varchar(45);`
  ];

  console.log('Running column sync statements...');
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      console.error('Error executing statement:', stmt, err.message);
    }
  }
  console.log('✓ All missing columns synced successfully!');
  await pool.end();
}

syncAllColumns().catch(console.error);
