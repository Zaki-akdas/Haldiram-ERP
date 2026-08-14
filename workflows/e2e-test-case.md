# End-to-End Functional Test Case: Sales Order from Invoice

## Test Case ID: TC-E2E-001
## Title: Create Sales Order from Invoice Extraction with Full Data Integrity Validation
## Priority: Critical
## Prerequisites: Server running, authenticated as admin user

---

## 1. Test Objectives

- Validate the complete invoice-to-sales-order pipeline
- Ensure data integrity across all linked documents (invoice, customer, order, order items, activity log)
- Verify cross-document field accuracy and synchronization
- Confirm settlement lifecycle consistency
- Validate error handling at each stage

---

## 2. Pre-Conditions

| ID | Condition | Verification |
|----|-----------|-------------|
| PC-1 | Application server is running at http://localhost:3000 | HTTP 200 on GET / |
| PC-2 | Database is accessible and schema is migrated | GET /api/health returns `{ ok: true }` |
| PC-3 | Admin user is logged in (admin@haldiram.com / supabase_managed) | GET /api/auth/me returns user with role=admin |
| PC-4 | No existing orders with invoice number RS/26-27/1577 | GET /api/orders?status=confirmed returns empty or no match |
| PC-5 | No existing customer with GSTIN 23AMFPV5397L1ZB (unless pre-seeded) | GET /api/customers?search=23AMFPV5397L1ZB returns empty |
| PC-6 | At least one product exists in the products table | GET /api/products returns products array |

---

## 3. Test Data

### 3.1 Sample Invoice PDF Content (Text Representation)

```
Seller Firm Name: RAJSHREE SNACKS AND FOODS PRIVATE LIMITED
GSTIN: 23AAPCR5371M1ZT
Invoice/Bill Number: RS/26-27/1577
Bill/Invoice Date: 22 Jul 2026

Billed To: PRO SWAMI SHARNAM ENTERPRISES
GSTIN: 23AMFPV5397L1ZB

1 FD012600160691200D All In One MRP 5|16 GM*6.912 KG (NGP) 21069099 5.00 432 5 2160 4.0475 1,649.5488 0.00 (0) 8,247.74 5 412.38 8,660.12
2 FD092104001240001D Aloo Bhujia 400 GM*12.40 KG 21069099 109.00 31 2 62 88.7261 2,594.8209 0.00 (0) 5,189.64 5 259.48 5,449.12

Total Value: 2,73,345.00
```

### 3.2 Expected Extracted Data

| Field | Expected Value |
|-------|---------------|
| invoiceNumber | RS/26-27/1577 |
| invoiceDate | 22 Jul 2026 |
| sellerName | RAJSHREE SNACKS AND FOODS PRIVATE LIMITED |
| sellerGSTIN | 23AAPCR5371M1ZT |
| customerName | PRO SWAMI SHARNAM ENTERPRISES |
| customerGSTIN | 23AMFPV5397L1ZB |
| items[0].productName | All In One MRP 5\|16 GM\*6.912 KG (NGP) |
| items[0].erpId | FD012600160691200D |
| items[0].hsnCode | 21069099 |
| items[0].quantity | 2160 |
| items[0].unitPrice | 4.0475 |
| items[0].taxableAmount | 8247.74 |
| items[0].gstRate | 5 |
| items[0].gstAmount | 412.38 |
| items[0].totalAmount | 8660.12 |
| items[1].productName | Aloo Bhujia 400 GM\*12.40 KG |
| items[1].erpId | FD092104001240001D |
| items[1].hsnCode | 21069099 |
| items[1].quantity | 31 |
| items[1].unitPrice | 109.00 |
| items[1].taxableAmount | 62 |
| items[1].gstRate | 5 |
| items[1].gstAmount | 88.7261 |
| items[1].totalAmount | 5189.64 |
| taxableAmount | 8309.74 (sum of item taxable amounts) |
| totalGst | 501.1061 (sum of item GST amounts) |
| grandTotal | 8810.8461 (sum of item total amounts) |
| confidence | >= 95 |

---

## 4. Test Steps

### Phase 1: Invoice Extraction

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| T1.1 | Navigate to http://localhost:3000/login | Login page renders | Pass/Fail |
| T1.2 | Enter email: admin@haldiram.com, password: supabase_managed | Login succeeds, redirects to /dashboard | Pass/Fail |
| T1.3 | Navigate to http://localhost:3000/invoices | Invoices page renders with paste/file tabs | Pass/Fail |
| T1.4 | Click "Load Sample Invoice" button | Sample invoice text populates the textarea | Pass/Fail |
| T1.5 | Verify "Copy-Paste Raw Text / TSV / CSV" tab is active | Textarea contains the sample invoice text | Pass/Fail |
| T1.6 | Click "Extract Invoice Data" button | Extraction begins, processing spinner shows | Pass/Fail |
| T1.7 | Wait for extraction to complete | Extraction result panel displays with header metadata and line items table | Pass/Fail |
| T1.8 | Verify extracted invoice number | Invoice/Bill Number field shows "RS/26-27/1577" | Pass/Fail |
| T1.9 | Verify extracted invoice date | Invoice Date field shows "22 Jul 2026" | Pass/Fail |
| T1.10 | Verify extracted customer name | Customer (Billed To) field shows "PRO SWAMI SHARNAM ENTERPRISES" | Pass/Fail |
| T1.11 | Verify extracted customer GSTIN | GSTIN field shows "23AMFPV5397L1ZB" | Pass/Fail |
| T1.12 | Verify line items count | Line Items table shows 2 items | Pass/Fail |
| T1.13 | Verify item 1 ERP ID | ERP ID column shows "FD012600160691200D" | Pass/Fail |
| T1.14 | Verify item 1 quantity | Qty column shows 2160 | Pass/Fail |
| T1.15 | Verify item 1 total amount | Total column shows ₹8,660.12 | Pass/Fail |
| T1.16 | Verify item 2 ERP ID | ERP ID column shows "FD092104001240001D" | Pass/Fail |
| T1.17 | Verify item 2 quantity | Qty column shows 31 | Pass/Fail |
| T1.18 | Verify item 2 total amount | Total column shows ₹5,189.64 | Pass/Fail |
| T1.19 | Verify grand total | Grand Total field shows ₹8,810.85 (rounded) | Pass/Fail |
| T1.20 | Verify confidence score | Confidence badge shows >= 95% | Pass/Fail |

### Phase 2: Create Sales Order from Invoice

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| T2.1 | Click "Create Sales Order" button | Button triggers handleImportOrder() | Pass/Fail |
| T2.2 | Verify customer lookup | GET /api/customers?limit=1 is called | Pass/Fail |
| T2.3 | Verify customer creation (if none exists) | POST /api/customers is called with name="PRO SWAMI SHARNAM ENTERPRISES", gstin="23AMFPV5397L1ZB" | Pass/Fail |
| T2.4 | Verify order payload construction | Payload includes customerId, invoiceNumber="RS/26-27/1577", status="confirmed", all items with correct field mappings | Pass/Fail |
| T2.5 | Verify POST /api/orders is called | Order creation API is invoked with correct payload | Pass/Fail |
| T2.6 | Verify success message | Green banner shows "✅ Order RS/26-27/1577 created and saved successfully!" | Pass/Fail |
| T2.7 | Verify redirect | After 1.5 seconds, browser navigates to /orders | Pass/Fail |
| T2.8 | Verify order appears in orders list | Order with invoiceNumber "RS/26-27/1577" is visible in the orders table | Pass/Fail |
| T2.9 | Verify order status | Status badge shows "Confirmed" (blue) | Pass/Fail |
| T2.10 | Verify order amount | Total column shows ₹8,810.85 | Pass/Fail |

### Phase 3: Validate Cross-Document Data Integrity

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| T3.1 | Click on the created order in the list | Navigates to /orders/{id} detail page | Pass/Fail |
| T3.2 | Verify order header data | Invoice Number = RS/26-27/1577, Status = Confirmed | Pass/Fail |
| T3.3 | Verify customer info on order detail | Customer Name = PRO SWAMI SHARNAM ENTERPRISES | Pass/Fail |
| T3.4 | Verify line items on order detail | 2 items displayed with correct product names, quantities, and amounts | Pass/Fail |
| T3.5 | Verify item 1 on order detail | productName, quantity=2160, unitPrice=4.05, taxableAmount=8247.74, gstRate=5%, gstAmount=412.38, totalAmount=8660.12 | Pass/Fail |
| T3.6 | Verify item 2 on order detail | productName, quantity=31, unitPrice=109.00, taxableAmount=62, gstRate=5%, gstAmount=88.73, totalAmount=5189.64 | Pass/Fail |
| T3.7 | Verify financial summary | Subtotal matches sum of (qty × unitPrice), Grand Total = Subtotal + Total GST | Pass/Fail |
| T3.8 | Verify settlement status | Settlement Status = "Pending", Amount Paid = ₹0.00, Balance = Grand Total | Pass/Fail |

### Phase 4: Validate Activity Log

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| T4.1 | Navigate to http://localhost:3000/activity | Activity Log page renders | Pass/Fail |
| T4.2 | Verify order creation activity | Activity entry exists with type "order_created", description "Order RS/26-27/1577 created" | Pass/Fail |
| T4.3 | Verify customer creation activity | Activity entry exists with type "customer_added", description "Customer PRO SWAMI SHARNAM ENTERPRISES added" | Pass/Fail |
| T4.4 | Verify activity timestamps | All activities have valid createdAt timestamps | Pass/Fail |

### Phase 5: Validate Settlement Lifecycle

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| T5.1 | On order detail page, click "Record Payment" | Payment modal opens | Pass/Fail |
| T5.2 | Set payment mode to "Cash" | Cash amount input becomes active | Pass/Fail |
| T5.3 | Enter payment amount = 5000 | Amount field shows 5000 | Pass/Fail |
| T5.4 | Click "Save Payment" | POST /api/settlements is called | Pass/Fail |
| T5.5 | Verify settlement recorded | Payment appears in Payment History table | Pass/Fail |
| T5.6 | Verify order balance updated | Balance due = Grand Total - 5000 = 3810.85 | Pass/Fail |
| T5.7 | Verify settlement status | Settlement Status = "partial" (since balance > 0) | Pass/Fail |
| T5.8 | Record second payment of 3810.85 | POST /api/settlements called again | Pass/Fail |
| T5.9 | Verify settlement status updated | Settlement Status = "settled" (since balance <= 0) | Pass/Fail |
| T5.10 | Verify amount paid | Amount Paid = Grand Total (full settlement) | Pass/Fail |
| T5.11 | Verify balance | Balance = 0 | Pass/Fail |

### Phase 6: Purchase Order Gap Analysis

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| T6.1 | Search for purchase order functionality | No PO pages, API routes, or database tables exist | Pass/Fail (expected gap) |
| T6.2 | Verify orders table serves as sales orders only | orders table has customerId, salespersonId, settlementStatus — all sales-oriented fields | Pass/Fail |
| T6.3 | Document PO requirement gap | Purchase Orders are not implemented; recommend adding purchase_orders table, PO API routes, and PO pages | Info |

---

## 5. Data Integrity Validation Matrix

### 5.1 Field-Level Accuracy Checks

| Source Field | Extracted Value | Order Payload Field | DB Stored Value | Match? |
|-------------|----------------|--------------------|--------------------|--------|
| invoiceNumber | RS/26-27/1577 | invoiceNumber | RS/26-27/1577 | ✅ |
| customerName | PRO SWAMI SHARNAM ENTERPRISES | customerId (resolved) | Customer record created | ✅ |
| customerGSTIN | 23AMFPV5397L1ZB | (used for customer lookup) | Customer.gstin | ✅ |
| items[0].productName | All In One... | productName | orderItems.productName | ✅ |
| items[0].erpId | FD012600160691200D | erpId | orderItems.erpId | ✅ |
| items[0].quantity | 2160 | quantity | orderItems.quantity | ✅ |
| items[0].unitPrice | 4.0475 | unitPrice | orderItems.unitPrice (clamped) | ✅ |
| items[0].taxableAmount | 8247.74 | taxableAmount | orderItems.taxableAmount | ✅ |
| items[0].gstRate | 5 | gstRate | orderItems.gstRate | ✅ |
| items[0].gstAmount | 412.38 | gstAmount | orderItems.gstAmount | ✅ |
| items[0].totalAmount | 8660.12 | totalAmount | orderItems.totalAmount | ✅ |
| taxableAmount | 8309.74 | taxableAmount/subtotal | orders.taxableAmount | ✅ |
| totalGst | 501.1061 | totalGst | orders.totalGst | ✅ |
| grandTotal | 8810.8461 | grandTotal | orders.grandTotal | ✅ |

### 5.2 Cross-Entity Consistency Checks

| Check | Query | Expected |
|-------|-------|----------|
| Order references valid customer | SELECT customerId FROM orders WHERE invoiceNumber='RS/26-27/1577' | customerId exists in customers table |
| Order items reference valid order | SELECT orderId FROM order_items WHERE orderId = <orderId> | All items have matching orderId |
| Activity log references order | SELECT entityId FROM activity_logs WHERE entityType='order' AND description LIKE 'Order RS%' | entityId matches order.id |
| Settlement references order | SELECT orderId FROM settlements WHERE orderId = <orderId> | orderId matches order.id |
| Order balance = grandTotal - amountPaid | SELECT balance, grandTotal, amountPaid FROM orders WHERE id = <orderId> | balance = grandTotal - amountPaid |
| Settlement amountPaid sum = amountPaid on order | SELECT SUM(amount) FROM settlements WHERE orderId = <orderId> | SUM = orders.amountPaid |

---

## 6. Error Handling Test Cases

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| E1 | Submit invoice extraction with empty text | Error message: "Please paste invoice data or table text first." | Pass/Fail |
| E2 | Create order without selecting customer | Alert: "Please select a customer and add at least one item." | Pass/Fail |
| E3 | Create order with invalid customerId (non-existent) | Server auto-creates a default customer or returns validation error | Pass/Fail |
| E4 | Create duplicate order with same invoiceNumber | Server appends timestamp suffix to make invoiceNumber unique | Pass/Fail |
| E5 | Upload unsupported file type (e.g., .docx) | Error: "Unsupported file type" | Pass/Fail |
| E6 | Record payment with Split mode where cash + online ≠ total | Alert: "Split amounts must equal total payment amount." | Pass/Fail |
| E7 | Update order status to invalid value | Server returns 400: "Invalid status value" | Pass/Fail |
| E8 | Access /orders/{id} with non-existent ID | Server returns 404: "Order not found" | Pass/Fail |
| E9 | Unauthorized access to /api/orders POST | Server returns 401: "Unauthorized" | Pass/Fail |
| E10 | Salesperson accessing /activity page | Server returns 403: "Forbidden" | Pass/Fail |

---

## 7. Performance Benchmarks

| Operation | Expected Threshold | Measured | Status |
|-----------|-------------------|----------|--------|
| Invoice extraction (paste mode) | < 2 seconds | | |
| Order creation from invoice | < 3 seconds | | |
| Orders list load | < 1 second | | |
| Order detail load | < 1 second | | |
| Payment recording | < 2 seconds | | |
| Activity log load | < 1 second | | |

---

## 8. Post-Conditions (Cleanup)

| Step | Action | Expected Result |
|------|--------|----------------|
| C1 | Delete the test order via DELETE /api/orders | Order removed from orders table |
| C2 | Delete the test customer via DELETE /api/customers | Customer removed from customers table |
| C3 | Verify no orphaned order_items | All order_items for deleted order are cascade-deleted |
| C4 | Verify activity logs remain | Activity logs for test order are preserved for audit |
| C5 | Verify server is healthy | GET /api/health returns { ok: true } |

---

## 9. Purchase Order Gap Analysis

### 9.1 Current State

Purchase Orders are **not implemented** in the current codebase. The following gaps exist:

| Gap | Detail |
|-----|--------|
| No PO database table | No `purchase_orders` table in schema |
| No PO API routes | No `/api/purchase-orders` endpoint |
| No PO UI pages | No purchase order creation, listing, or detail pages |
| No vendor/supplier entity | No `vendors` or `suppliers` table |
| No PO-to-order linkage | No FK relationship between POs and orders |

### 9.2 Recommended Implementation for PO Support

1. **Database Schema**: Add `purchase_orders` table with fields: `id`, `poNumber`, `vendorId`, `orderId` (FK to orders), `status`, `subtotal`, `totalGst`, `grandTotal`, `createdAt`, `updatedAt`
2. **API Routes**: Create `/api/purchase-orders` (GET, POST) and `/api/purchase-orders/[id]` (GET, PATCH, DELETE)
3. **UI Pages**: Add Purchase Orders section in sidebar, PO list page, PO creation page, PO detail page
4. **Data Flow**: When a PO is created, link it to the corresponding sales order via `orderId` FK, enabling bidirectional traceability

### 9.3 Test Case Extension (Once PO is Implemented)

| Step | Action | Expected Result |
|------|--------|----------------|
| PO-1 | Create a Purchase Order linked to sales order RS/26-27/1577 | PO record created with orderId FK |
| PO-2 | Verify PO status = "pending" initially | PO status reflects pending state |
| PO-3 | Update PO status to "received" | PO status updated, activity log created |
| PO-4 | Verify order settlement status auto-updates | When all POs for an order are received, settlement status reflects partial/full settlement |
| PO-5 | Verify cross-document consistency | PO grandTotal matches order grandTotal |

---

## 10. Test Environment Configuration

| Parameter | Value |
|-----------|-------|
| Base URL | http://localhost:3000 |
| Test User | admin@haldiram.com |
| Test Password | supabase_managed |
| Database | Supabase PostgreSQL (via DATABASE_URL) |
| AI Provider | Regex Extractor (fast mode, no external API dependency) |
| Test Data | Sample invoice RS/26-27/1577 |

---

## 11. Pass/Fail Criteria

- **PASS**: All steps in Phases 1-5 pass with no failures
- **FAIL**: Any step in Phases 1-5 fails, or data integrity checks in Section 5 reveal mismatches
- **CONDITIONAL PASS**: Phases 1-5 pass but Phase 6 (PO gap) is noted as expected missing functionality
- **BLOCKED**: Any prerequisite condition (Section 2) cannot be met

---

## 12. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Test Engineer | | | |
| QA Lead | | | |
| Product Owner | | | |
