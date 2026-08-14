const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  console.log('🌱 Starting Full ERP Demo Data Seeding...');

  // 1. Ensure Admin, Manager, Salesperson users exist
  console.log('1. Checking Users...');
  let userRes = await pool.query('SELECT id, role, email FROM users');
  let adminId, managerId, salesId;

  const admin = userRes.rows.find(u => u.email === 'admin@haldiram.com');
  if (admin) {
    adminId = admin.id;
  } else {
    const ins = await pool.query(`
      INSERT INTO users (email, password, name, role, is_active)
      VALUES ('admin@haldiram.com', 'supabase_managed', 'Rajesh Sharma (Admin)', 'admin', true)
      RETURNING id
    `);
    adminId = ins.rows[0].id;
  }

  const manager = userRes.rows.find(u => u.role === 'manager');
  if (manager) {
    managerId = manager.id;
  } else {
    const ins = await pool.query(`
      INSERT INTO users (email, password, name, role, is_active)
      VALUES ('manager@haldiram.com', 'supabase_managed', 'Vikram Singh (Manager)', 'manager', true)
      RETURNING id
    `);
    managerId = ins.rows[0].id;
  }

  const sales = userRes.rows.find(u => u.role === 'salesperson');
  if (sales) {
    salesId = sales.id;
  } else {
    const ins = await pool.query(`
      INSERT INTO users (email, password, name, role, is_active)
      VALUES ('sales@haldiram.com', 'supabase_managed', 'Amit Kumar (Salesperson)', 'salesperson', true)
      RETURNING id
    `);
    salesId = ins.rows[0].id;
  }

  console.log(`Users verified. Admin ID: ${adminId}, Manager ID: ${managerId}, Sales ID: ${salesId}`);

  // 2. Customers
  console.log('2. Seeding Customers...');
  const customerList = [
    { name: 'Raju Supermarket', phone: '9876543210', email: 'raju@supermarket.in', gstin: '23AMFPV5397L1ZB', address: '12 M.G. Road', city: 'Bhopal', state: 'Madhya Pradesh', pincode: '462001', beat: 'Central Beat', creditLimit: 500000 },
    { name: 'Metro Mart Wholesale', phone: '9812345678', email: 'orders@metromart.com', gstin: '23AAPCR5371M1ZT', address: '45 Commercial Hub', city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', beat: 'West Zone', creditLimit: 1000000 },
    { name: 'Daily Needs Store', phone: '9765432109', email: 'contact@dailyneeds.in', gstin: '23AAACR1234F1Z0', address: '78 New Market', city: 'Bhopal', state: 'Madhya Pradesh', pincode: '462003', beat: 'Central Beat', creditLimit: 300000 },
    { name: 'Choice Provision Store', phone: '9988776655', email: 'choice@provisions.in', gstin: '23BBBCA9876K1Z9', address: '101 Main Bazaar', city: 'Gwalior', state: 'Madhya Pradesh', pincode: '474001', beat: 'North Beat', creditLimit: 250000 },
    { name: 'Haldiram Express Counter', phone: '9425011223', email: 'express@haldiram.com', gstin: '23AMFPV5397L1ZB', address: 'Platform 1 Railway Station', city: 'Bhopal', state: 'Madhya Pradesh', pincode: '462010', beat: 'Railway Beat', creditLimit: 750000 },
  ];

  const custIds = [];
  for (const c of customerList) {
    const existing = await pool.query('SELECT id FROM customers WHERE name = $1', [c.name]);
    if (existing.rows.length > 0) {
      custIds.push(existing.rows[0].id);
    } else {
      const ins = await pool.query(`
        INSERT INTO customers (name, phone, email, gstin, address, city, state, pincode, beat, credit_limit, assigned_salesperson_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [c.name, c.phone, c.email, c.gstin, c.address, c.city, c.state, c.pincode, c.beat, c.creditLimit, salesId]);
      custIds.push(ins.rows[0].id);
    }
  }
  console.log(`Customers ready: ${custIds.length} items`);

  // 3. Products
  console.log('3. Seeding Products...');
  const productList = [
    { erpId: 'FD012600', name: 'Haldiram Aloo Bhujia 400g', category: 'Namkeen', unit: 'PCS', mrp: 120, basePrice: 95.00, gstRate: 12, hsnCode: '21069099', stockQty: 450 },
    { erpId: 'FD092104', name: 'Haldiram Moong Dal 200g', category: 'Namkeen', unit: 'PCS', mrp: 55, basePrice: 42.00, gstRate: 12, hsnCode: '21069099', stockQty: 600 },
    { erpId: 'FD018000', name: 'Haldiram Soan Papdi 500g', category: 'Sweets', unit: 'PCS', mrp: 180, basePrice: 140.00, gstRate: 18, hsnCode: '21069099', stockQty: 200 },
    { erpId: 'FD054321', name: 'Haldiram Bhujia Sev 1kg', category: 'Namkeen', unit: 'PCS', mrp: 260, basePrice: 210.00, gstRate: 12, hsnCode: '21069099', stockQty: 150 },
    { erpId: 'FD012601', name: 'Haldiram All In One 16g', category: 'Pouch Pack', unit: 'PCS', mrp: 5, basePrice: 3.80, gstRate: 5, hsnCode: '21069099', stockQty: 2500 },
    { erpId: 'FD087654', name: 'Haldiram Nut Cracker 200g', category: 'Namkeen', unit: 'PCS', mrp: 65, basePrice: 50.00, gstRate: 12, hsnCode: '21069099', stockQty: 380 },
    { erpId: 'FD099887', name: 'Haldiram Rasgulla 1kg Tin', category: 'Sweets', unit: 'PCS', mrp: 240, basePrice: 190.00, gstRate: 18, hsnCode: '21069099', stockQty: 120 },
  ];

  const prodIds = [];
  for (const p of productList) {
    const existing = await pool.query('SELECT id FROM products WHERE erp_id = $1 OR name = $2', [p.erpId, p.name]);
    if (existing.rows.length > 0) {
      prodIds.push({ id: existing.rows[0].id, ...p });
    } else {
      const ins = await pool.query(`
        INSERT INTO products (erp_id, name, category, unit, mrp, base_price, gst_rate, hsn_code, stock_qty)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [p.erpId, p.name, p.category, p.unit, p.mrp, p.basePrice, p.gstRate, p.hsnCode, p.stockQty]);
      prodIds.push({ id: ins.rows[0].id, ...p });
    }
  }
  console.log(`Products ready: ${prodIds.length} items`);

  // 4. Create Demo Orders
  console.log('4. Seeding Demo Orders and Line Items...');
  const existingOrders = await pool.query('SELECT count(*) FROM orders');
  if (parseInt(existingOrders.rows[0].count) < 3) {
    const sampleOrders = [
      {
        invoiceNumber: `INV-2026-${Date.now().toString().slice(-4)}1`,
        customerId: custIds[0],
        salespersonId: salesId,
        status: 'confirmed',
        subtotal: 950.00,
        taxableAmount: 950.00,
        cgst: 57.00,
        sgst: 57.00,
        totalGst: 114.00,
        grandTotal: 1064.00,
        amountPaid: 1064.00,
        balance: 0.00,
        settlementStatus: 'settled',
        beat: 'Central Beat',
        notes: 'Delivered and paid on route',
        items: [
          { prod: prodIds[0], qty: 10, price: 95.00, disc: 0, taxable: 950.00, gstRate: 12, gstAmt: 114.00, total: 1064.00 }
        ]
      },
      {
        invoiceNumber: `INV-2026-${Date.now().toString().slice(-4)}2`,
        customerId: custIds[1],
        salespersonId: salesId,
        status: 'pending',
        subtotal: 3500.00,
        taxableAmount: 3500.00,
        cgst: 210.00,
        sgst: 210.00,
        totalGst: 420.00,
        grandTotal: 3920.00,
        amountPaid: 1000.00,
        balance: 2920.00,
        settlementStatus: 'partial',
        beat: 'West Zone',
        notes: 'Advance 1000 received via UPI',
        items: [
          { prod: prodIds[1], qty: 50, price: 42.00, disc: 0, taxable: 2100.00, gstRate: 12, gstAmt: 252.00, total: 2352.00 },
          { prod: prodIds[2], qty: 10, price: 140.00, disc: 0, taxable: 1400.00, gstRate: 18, gstAmt: 252.00, total: 1652.00 }
        ]
      },
      {
        invoiceNumber: `INV-2026-${Date.now().toString().slice(-4)}3`,
        customerId: custIds[2],
        salespersonId: salesId,
        status: 'delivered',
        subtotal: 2100.00,
        taxableAmount: 2100.00,
        cgst: 126.00,
        sgst: 126.00,
        totalGst: 252.00,
        grandTotal: 2352.00,
        amountPaid: 0.00,
        balance: 2352.00,
        settlementStatus: 'pending',
        beat: 'Central Beat',
        notes: 'Payment due in 15 days',
        items: [
          { prod: prodIds[3], qty: 10, price: 210.00, disc: 0, taxable: 2100.00, gstRate: 12, gstAmt: 252.00, total: 2352.00 }
        ]
      }
    ];

    for (const ord of sampleOrders) {
      const insOrd = await pool.query(`
        INSERT INTO orders (
          invoice_number, customer_id, salesperson_id, status, subtotal, taxable_amount,
          cgst, sgst, igst, total_gst, grand_total, amount_paid, balance, settlement_status, beat, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `, [
        ord.invoiceNumber, ord.customerId, ord.salespersonId, ord.status, ord.subtotal,
        ord.taxableAmount, ord.cgst, ord.sgst, ord.totalGst, ord.grandTotal, ord.amountPaid,
        ord.balance, ord.settlementStatus, ord.beat, ord.notes
      ]);

      const orderId = insOrd.rows[0].id;

      for (const item of ord.items) {
        await pool.query(`
          INSERT INTO order_items (
            order_id, product_id, erp_id, product_name, quantity, unit_price, discount,
            taxable_amount, gst_rate, gst_amount, total_amount, unit
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          orderId, item.prod.id, item.prod.erpId, item.prod.name, item.qty, item.price,
          item.disc, item.taxable, item.gstRate, item.gstAmt, item.total, 'PCS'
        ]);
      }

      // Add settlement record if amountPaid > 0
      if (ord.amountPaid > 0) {
        await pool.query(`
          INSERT INTO settlements (
            order_id, customer_id, salesperson_id, amount, cash_amount, online_amount, payment_mode, reference_number, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          orderId, ord.customerId, ord.salespersonId, ord.amountPaid,
          ord.settlementStatus === 'settled' ? ord.amountPaid : 0,
          ord.settlementStatus === 'partial' ? ord.amountPaid : 0,
          ord.settlementStatus === 'settled' ? 'Cash' : 'Online',
          ord.settlementStatus === 'partial' ? 'UPI-99887766' : 'CASH-REC',
          'Automated Demo Settlement'
        ]);
      }

      // Log activity
      await pool.query(`
        INSERT INTO activity_logs (user_id, activity_type, entity_type, entity_id, description)
        VALUES ($1, 'order_created', 'order', $2, $3)
      `, [salesId, orderId, `Order ${ord.invoiceNumber} created with total ₹${ord.grandTotal}`]);
    }
    console.log('Sample orders, line items, settlements, and activity logs inserted!');
  } else {
    console.log('Existing orders found in database, keeping existing data.');
  }

  await pool.end();
  console.log('✅ Demo Data Seeding Complete!');
}

seed().catch(err => {
  console.error('❌ Seeding Error:', err);
  process.exit(1);
});
