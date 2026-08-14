const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const tables = ['users', 'customers', 'products', 'orders', 'order_items', 'settlements', 'invoices', 'activity_logs', 'sessions'];
  for (const t of tables) {
    const res = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [t]);
    console.log(`Table: ${t}`);
    console.log(`Columns: ${res.rows.map(r => r.column_name).join(', ')}\n`);
  }
  await pool.end();
}

check().catch(console.error);
