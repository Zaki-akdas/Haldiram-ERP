import { pgTable, serial, text, varchar, timestamp, decimal, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'salesperson']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'delivered', 'cancelled']);
export const settlementStatusEnum = pgEnum('settlement_status', ['pending', 'partial', 'settled']);
export const activityTypeEnum = pgEnum('activity_type', ['login', 'logout', 'order_created', 'order_updated', 'settlement', 'invoice_uploaded', 'customer_added', 'product_added']);

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('salesperson'),
  phone: varchar('phone', { length: 20 }),
  avatar: text('avatar'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Customers table
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  gstin: varchar('gstin', { length: 15 }),
  pan: varchar('pan', { length: 10 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  pincode: varchar('pincode', { length: 10 }),
  beat: varchar('beat', { length: 255 }),
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).default('0'),
  outstandingBalance: decimal('outstanding_balance', { precision: 12, scale: 2 }).default('0'),
  assignedSalespersonId: integer('assigned_salesperson_id').references(() => users.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Products table
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  erpId: varchar('erp_id', { length: 50 }).unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  unit: varchar('unit', { length: 20 }).default('PCS'),
  mrp: decimal('mrp', { precision: 10, scale: 2 }).notNull(),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
  gstRate: decimal('gst_rate', { precision: 5, scale: 2 }).default('18'),
  hsnCode: varchar('hsn_code', { length: 20 }),
  stockQty: integer('stock_qty').default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Orders table
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  salespersonId: integer('salesperson_id').notNull().references(() => users.id),
  orderDate: timestamp('order_date').notNull().defaultNow(),
  deliveryDate: timestamp('delivery_date'),
  status: orderStatusEnum('status').notNull().default('pending'),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxableAmount: decimal('taxable_amount', { precision: 12, scale: 2 }).notNull(),
  cgst: decimal('cgst', { precision: 12, scale: 2 }).default('0'),
  sgst: decimal('sgst', { precision: 12, scale: 2 }).default('0'),
  igst: decimal('igst', { precision: 12, scale: 2 }).default('0'),
  totalGst: decimal('total_gst', { precision: 12, scale: 2 }).default('0'),
  grandTotal: decimal('grand_total', { precision: 12, scale: 2 }).notNull(),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).default('0'),
  balance: decimal('balance', { precision: 12, scale: 2 }).notNull(),
  settlementStatus: settlementStatusEnum('settlement_status').notNull().default('pending'),
  beat: varchar('beat', { length: 255 }),
  notes: text('notes'),
  creditDays: integer('credit_days').default(0), // New: Default credit period
  dueDate: timestamp('due_date'), // New: Calculated due date
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Order Items table
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').references(() => products.id),
  erpId: varchar('erp_id', { length: 50 }),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  shortQuantity: integer('short_quantity').default(0), // New: Items not delivered
  returnQuantity: integer('return_quantity').default(0), // New: Items returned
  returnReason: text('return_reason'),
  unit: varchar('unit', { length: 20 }).default('PCS'),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 10, scale: 2 }).default('0'),
  taxableAmount: decimal('taxable_amount', { precision: 10, scale: 2 }).notNull(),
  gstRate: decimal('gst_rate', { precision: 5, scale: 2 }).default('0'),
  gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Settlements table
export const settlements = pgTable('settlements', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  salespersonId: integer('salesperson_id').notNull().references(() => users.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  cashAmount: decimal('cash_amount', { precision: 12, scale: 2 }).default('0'), // New: Split payment
  onlineAmount: decimal('online_amount', { precision: 12, scale: 2 }).default('0'), // New: Split payment
  paymentMode: varchar('payment_mode', { length: 50 }).notNull(), // 'cash', 'online', 'split', 'cheque', 'credit_note'
  denominations: jsonb('denominations'), 
  clearingDays: integer('clearing_days').default(0), // New: Days for cheque clearing
  referenceNumber: varchar('reference_number', { length: 100 }),
  notes: text('notes'),
  settledAt: timestamp('settled_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Invoices table (for uploaded invoice documents)
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(),
  fileSize: integer('file_size'),
  extractedData: jsonb('extracted_data'),
  validationResult: jsonb('validation_result'),
  importedOrderId: integer('imported_order_id').references(() => orders.id),
  uploadedById: integer('uploaded_by_id').notNull().references(() => users.id),
  status: varchar('status', { length: 50 }).default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Activity Log table
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  activityType: activityTypeEnum('activity_type').notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: integer('entity_id'),
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Sessions table (for auth)
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  settlements: many(settlements),
  customers: many(customers),
  activityLogs: many(activityLogs),
  invoices: many(invoices),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  assignedSalesperson: one(users, {
    fields: [customers.assignedSalespersonId],
    references: [users.id],
  }),
  orders: many(orders),
  settlements: many(settlements),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  salesperson: one(users, {
    fields: [orders.salespersonId],
    references: [users.id],
  }),
  items: many(orderItems),
  settlements: many(settlements),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  order: one(orders, {
    fields: [settlements.orderId],
    references: [orders.id],
  }),
  customer: one(customers, {
    fields: [settlements.customerId],
    references: [customers.id],
  }),
  salesperson: one(users, {
    fields: [settlements.salespersonId],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  uploadedBy: one(users, {
    fields: [invoices.uploadedById],
    references: [users.id],
  }),
  importedOrder: one(orders, {
    fields: [invoices.importedOrderId],
    references: [orders.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
