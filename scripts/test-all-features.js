const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runTests() {
  console.log('🧪 Running Comprehensive ERP Integration Tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Database Table Checks
  console.log('Test Suite 1: Database Tables & Counts');
  const tables = ['users', 'customers', 'products', 'orders', 'order_items', 'settlements', 'activity_logs'];
  for (const t of tables) {
    const res = await pool.query(`SELECT count(*) FROM ${t}`);
    const count = parseInt(res.rows[0].count);
    assert(count >= 0, `Table '${t}' exists with ${count} row(s)`);
  }

  // 2. Data Relations & Foreign Key Integrity
  console.log('\nTest Suite 2: Data Relations & Synchronization Integrity');

  const ordersRes = await pool.query(`
    SELECT o.id, o.invoice_number, o.grand_total, o.amount_paid, o.balance, o.settlement_status,
           c.name as customer_name, u.name as salesperson_name
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN users u ON o.salesperson_id = u.id
  `);

  assert(ordersRes.rows.length > 0, `Orders found with joined customer & salesperson names`);

  for (const ord of ordersRes.rows) {
    assert(ord.customer_name != null, `Order ${ord.invoice_number} correctly linked to customer '${ord.customer_name}'`);
    assert(ord.salesperson_name != null, `Order ${ord.invoice_number} correctly linked to salesperson '${ord.salesperson_name}'`);

    const grandTotal = parseFloat(ord.grand_total);
    const amountPaid = parseFloat(ord.amount_paid);
    const balance = parseFloat(ord.balance);

    assert(Math.abs((grandTotal - amountPaid) - balance) < 0.01, `Order ${ord.invoice_number} balance calculation correct (Total: ₹${grandTotal}, Paid: ₹${amountPaid}, Balance: ₹${balance})`);
  }

  // 3. Order Items Integrity
  console.log('\nTest Suite 3: Order Items Calculation');
  const itemsRes = await pool.query(`
    SELECT i.order_id, i.product_name, i.quantity, i.unit_price, i.taxable_amount, i.gst_rate, i.gst_amount, i.total_amount
    FROM order_items i
  `);

  assert(itemsRes.rows.length > 0, `Order items exist in database (${itemsRes.rows.length} items)`);

  for (const item of itemsRes.rows) {
    const qty = parseInt(item.quantity);
    const price = parseFloat(item.unit_price);
    const taxable = parseFloat(item.taxable_amount);
    const gstRate = parseFloat(item.gst_rate);
    const gstAmt = parseFloat(item.gst_amount);
    const total = parseFloat(item.total_amount);

    assert(qty > 0, `Item '${item.product_name}' has valid quantity: ${qty}`);
    assert(Math.abs((taxable * (gstRate / 100)) - gstAmt) < 0.05, `Item '${item.product_name}' GST calculation correct (${gstRate}% of ₹${taxable} = ₹${gstAmt})`);
    assert(Math.abs((taxable + gstAmt) - total) < 0.05, `Item '${item.product_name}' total amount correct (Taxable ₹${taxable} + GST ₹${gstAmt} = ₹${total})`);
  }

  // 4. Settlements & Order Payment Synchronization
  console.log('\nTest Suite 4: Settlements & Order Payment Synchronization');
  const settlementsRes = await pool.query(`
    SELECT s.id, s.order_id, s.amount, s.payment_mode, o.grand_total, o.amount_paid, o.settlement_status
    FROM settlements s
    JOIN orders o ON s.order_id = o.id
  `);

  assert(settlementsRes.rows.length > 0, `Settlement records found linked to orders (${settlementsRes.rows.length} settlements)`);

  for (const st of settlementsRes.rows) {
    const stAmount = parseFloat(st.amount);
    const ordPaid = parseFloat(st.amount_paid);

    assert(stAmount > 0, `Settlement #${st.id} recorded for ₹${stAmount} via ${st.payment_mode}`);
    assert(ordPaid >= stAmount, `Order #${st.order_id} total paid amount (₹${ordPaid}) properly reflects settlement (₹${stAmount})`);
  }

  // 5. Activity Log Tracking
  console.log('\nTest Suite 5: Activity Log Tracking');
  const activityRes = await pool.query(`SELECT count(*) FROM activity_logs`);
  const actCount = parseInt(activityRes.rows[0].count);
  assert(actCount > 0, `System activity logs recorded (${actCount} logs)`);

  console.log(`\n==============================================`);
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==============================================\n`);

  await pool.end();
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
