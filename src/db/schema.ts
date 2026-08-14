import { pgTable, serial, varchar, text, integer, boolean, timestamp, numeric, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'salesperson']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'delivered', 'cancelled']);
export const settlementStatusEnum = pgEnum('settlement_status', ['pending', 'partial', 'settled']);
export const activityTypeEnum = pgEnum('activity_type', ['login', 'logout', 'order_created', 'order_updated', 'settlement', 'invoice_uploaded', 'customer_added', 'product_added']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').default('salesperson').notNull(),
  phone: varchar('phone', { length: 20 }),
  avatar: text('avatar'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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
  pincode: varchar('pincode', { length: 6 }),
  beat: varchar('beat', { length: 100 }),
  creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).default('0'),
  outstandingBalance: numeric('outstanding_balance', { precision: 12, scale: 2 }).default('0'),
  assignedSalespersonId: integer('assigned_salesperson_id').references(() => users.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  erpId: varchar('erp_id', { length: 50 }).unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  unit: varchar('unit', { length: 20 }).default('PCS'),
  mrp: numeric('mrp', { precision: 10, scale: 2 }),
  basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  gstRate: numeric('gst_rate', { precision: 5, scale: 2 }).default('18'),
  hsnCode: varchar('hsn_code', { length: 10 }),
  stockQty: integer('stock_qty').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  salespersonId: integer('salesperson_id').references(() => users.id).notNull(),
  orderDate: timestamp('order_date').defaultNow(),
  deliveryDate: timestamp('delivery_date'),
  status: orderStatusEnum('status').default('pending'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0'),
  taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).default('0'),
  cgst: numeric('cgst', { precision: 10, scale: 2 }).default('0'),
  sgst: numeric('sgst', { precision: 10, scale: 2 }).default('0'),
  igst: numeric('igst', { precision: 10, scale: 2 }).default('0'),
  totalGst: numeric('total_gst', { precision: 10, scale: 2 }).default('0'),
  grandTotal: numeric('grand_total', { precision: 12, scale: 2 }).default('0'),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0'),
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0'),
  settlementStatus: settlementStatusEnum('settlement_status').default('pending'),
  beat: varchar('beat', { length: 100 }),
  notes: text('notes'),
  creditDays: integer('credit_days').default(0),
  dueDate: timestamp('due_date'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  productId: integer('product_id').references(() => products.id),
  erpId: varchar('erp_id', { length: 50 }),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  shortQuantity: integer('short_quantity').default(0),
  returnQuantity: integer('return_quantity').default(0),
  returnReason: text('return_reason'),
  unit: varchar('unit', { length: 20 }).default('PCS'),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 10, scale: 2 }).default('0'),
  taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).default('0'),
  gstRate: numeric('gst_rate', { precision: 5, scale: 2 }).default('18'),
  gstAmount: numeric('gst_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const settlements = pgTable('settlements', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  salespersonId: integer('salesperson_id').references(() => users.id).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  cashAmount: numeric('cash_amount', { precision: 12, scale: 2 }).default('0'),
  onlineAmount: numeric('online_amount', { precision: 12, scale: 2 }).default('0'),
  paymentMode: varchar('payment_mode', { length: 50 }).notNull(),
  denominations: jsonb('denominations'),
  clearingDays: integer('clearing_days'),
  referenceNumber: varchar('reference_number', { length: 100 }),
  notes: text('notes'),
  settledAt: timestamp('settled_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 50 }),
  fileSize: integer('file_size'),
  extractedData: jsonb('extracted_data'),
  validationResult: jsonb('validation_result'),
  importedOrderId: integer('imported_order_id').references(() => orders.id),
  uploadedById: integer('uploaded_by_id').references(() => users.id),
  status: varchar('status', { length: 20 }).default('uploaded'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  activityType: activityTypeEnum('activity_type').notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: integer('entity_id'),
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  token: varchar('token', { length: 500 }).unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

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

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;

export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;

export type Settlement = InferSelectModel<typeof settlements>;
export type NewSettlement = InferInsertModel<typeof settlements>;

export type Invoice = InferSelectModel<typeof invoices>;
export type NewInvoice = InferInsertModel<typeof invoices>;

export type ActivityLog = InferSelectModel<typeof activityLogs>;
export type NewActivityLog = InferInsertModel<typeof activityLogs>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
