# Functional Specification: Cash Denomination Entry for Payments

## 1. Overview

This feature allows users to record cash payments by specifying the exact denominations received (e.g., number of ₹5, ₹10, ₹20, ₹50, ₹100, ₹200, ₹500 notes). This facilitates accurate end-of-shift cash settlement, reconciliation, and audit trail.

## 2. User Interface Requirements

### 2.1 Trigger Point

- The denomination entry UI is triggered when a user records a **Cash** payment from:
  - `/orders/[id]` page → "Record Payment" modal → Payment Mode = `Cash`
  - Any future cash payment entry points in the application

### 2.2 UI Layout

The denomination entry shall appear **inside the existing "Record Payment" modal**, directly below the "Total Amount (₹)" input field, when `paymentMode === 'Cash'`.

```
┌─────────────────────────────────────────────┐
│ Record Payment                              │
├─────────────────────────────────────────────┤
│ Payment Mode: [Cash] [Online] [Cheque] [Split] │
│                                             │
│ Total Amount (₹)                            │
│ [________________________]                  │
│                                             │
│ Cash Denominations (Optional)               │
│ ┌─────────────────────────────────────────┐ │
│ │ ₹500  [  ] × 0  = ₹0                  │ │
│ │ ₹200  [  ] × 0  = ₹0                  │ │
│ │ ₹100  [  ] × 0  = ₹0                  │ │
│ │ ₹50   [  ] × 0  = ₹0                  │ │
│ │ ₹20   [  ] × 0  = ₹0                  │ │
│ │ ₹10   [  ] × 0  = ₹0                  │ │
│ │ ₹5    [  ] × 0  = ₹0                  │ │
│ │ ₹2    [  ] × 0  = ₹0                  │ │
│ │ ₹1    [  ] × 0  = ₹0                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Calculated Cash Total: ₹0                   │
│                                             │
│ Cash Order Notes *                          │
│ [________________________________________]   │
│                                             │
│ [Cancel]                        [Save Payment]│
└─────────────────────────────────────────────┘
```

### 2.3 Field Specifications

| Field | Type | Validation | Default |
|-------|------|------------|---------|
| Denomination input | Number | Min 0, integer only | 0 |
| Calculated line total | Auto-calculated | Read-only | denomination × quantity |
| Calculated cash total | Auto-calculated | Read-only | sum of all lines |
| Total Amount | Number | Min 0, required | - |

### 2.4 Behavior Rules

1. **Auto-calculation**: Each denomination line auto-calculates `denomination × quantity`.
2. **Total sync**: The "Calculated Cash Total" must equal the "Total Amount (₹)" when all denominations are entered.
3. **Mismatch warning**: If calculated cash total ≠ entered total amount, display a non-blocking warning: *"Cash total does not match payment amount."*
4. **Optional**: Denominations are optional. If left empty, the payment can still be saved.
5. **Focus management**: Tab order should flow naturally from Total Amount → first denomination input → last denomination input → Cash Order Notes.
6. **Mobile responsive**: The denomination grid should stack cleanly on small screens.

## 3. Data Structure

### 3.1 New Database Table

```sql
CREATE TABLE payment_denominations (
  id SERIAL PRIMARY KEY,
  settlement_id INTEGER REFERENCES settlements(id) ON DELETE CASCADE,
  denomination INTEGER NOT NULL CHECK (denomination IN (1, 2, 5, 10, 20, 50, 100, 200, 500)),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `settlement_id` | INTEGER | Foreign key to `settlements.id` |
| `denomination` | INTEGER | Note value (1, 2, 5, 10, 20, 50, 100, 200, 500) |
| `quantity` | INTEGER | Number of notes received |
| `subtotal` | NUMERIC(12,2) | `denomination × quantity` |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Record update timestamp |

### 3.3 Indexes

```sql
CREATE INDEX idx_payment_denominations_settlement_id ON payment_denominations(settlement_id);
```

### 3.4 Schema Integration

- The `payment_denominations` table is linked to the existing `settlements` table via `settlement_id`.
- One settlement can have multiple denomination rows (one per denomination type).
- Deleting a settlement cascades to its denominations.

## 4. API Requirements

### 4.1 Save Denominations with Payment

**Endpoint:** `POST /api/settlements`

When `paymentMode === 'Cash'`, the request body may include:

```json
{
  "orderId": 123,
  "amount": 5000,
  "paymentMode": "Cash",
  "notes": "Cash received",
  "denominations": [
    { "denomination": 500, "quantity": 5 },
    { "denomination": 200, "quantity": 5 },
    { "denomination": 100, "quantity": 10 }
  ]
}
```

**Backend behavior:**
1. Validate `amount` equals sum of all `denomination × quantity`.
2. Create the settlement record.
3. Create `payment_denominations` records linked to the new settlement ID.
4. Return the created settlement with denominations included.

### 4.2 Fetch Denominations with Settlement

**Endpoint:** `GET /api/settlements?orderId=123`

The response should include denominations:

```json
{
  "settlements": [
    {
      "id": 456,
      "amount": 5000,
      "paymentMode": "Cash",
      "notes": "Cash received",
      "denominations": [
        { "denomination": 500, "quantity": 5, "subtotal": 2500 },
        { "denomination": 200, "quantity": 5, "subtotal": 1000 },
        { "denomination": 100, "quantity": 10, "subtotal": 1000 }
      ]
    }
  ]
}
```

### 4.3 Settlement Reporting Endpoint

**Endpoint:** `GET /api/settlements/denomination-summary`

Query params:
- `startDate` (optional)
- `endDate` (optional)
- `userId` (optional)

Response:

```json
{
  "summary": [
    { "denomination": 500, "totalQuantity": 120, "totalValue": 60000 },
    { "denomination": 200, "totalQuantity": 85, "totalValue": 17000 },
    { "denomination": 100, "totalQuantity": 210, "totalValue": 21000 }
  ],
  "totalCashReceived": 98000,
  "generatedAt": "2026-08-05T13:56:00+05:30"
}
```

## 5. Settlement Reporting Utilization

### 5.1 End-of-Shift Reconciliation

The denomination data enables:
1. **Cash count verification**: At shift end, staff can count physical notes and compare against the system-recorded denominations.
2. **Discrepancy detection**: Identify overages/shortages by denomination.
3. **Audit trail**: Track who received what denominations and when.

### 5.2 Report Views

#### View 1: Daily Cash Summary
- Group by denomination
- Show total quantity and value per denomination
- Highlight discrepancies between recorded and counted cash

#### View 2: User-wise Cash Received
- Filter by salesperson/date range
- See which user received which denominations

#### View 3: Order-level Denomination Detail
- Drill down from order → settlement → denominations
- Useful for dispute resolution

## 6. Validation Rules

| Rule | Description | Error Message |
|------|-------------|---------------|
| Amount match | Sum of denominations must equal `amount` | "Cash total does not match payment amount" |
| Non-negative quantity | `quantity >= 0` | "Quantity cannot be negative" |
| Valid denomination | Must be one of predefined values | "Invalid denomination" |
| Cash mode only | Denominations only allowed when `paymentMode === 'Cash'` | "Denominations only applicable for cash payments" |

## 7. Edge Cases

1. **Partial denominations**: User enters only some denominations (e.g., only ₹500 notes). The rest default to 0. System shows mismatch warning.
2. **Zero amount payment**: If `amount` is 0, all denominations must be 0.
3. **Large quantities**: Support quantities up to 10,000 per denomination.
4. **Split payments**: If payment mode is `Split` (Cash + Online), denominations apply only to the cash portion. The UI should show:
   - Cash portion: `X`
   - Denominations for cash portion only
   - Online portion: `Y`

## 8. Future Enhancements

- Barcode/QR scanning for denomination entry
- Import denominations from CSV (for bulk reconciliation)
- Integration with physical cash drawer counting devices
- Automatic suggestion of denominations based on amount entered
