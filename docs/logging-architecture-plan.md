# Logging Architecture Plan

## Overview
The Haldiram ERP system implements a comprehensive activity logging system to track all significant user actions and system events.

## Activity Log Table Structure

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| userId | integer | FK to users table |
| activityType | enum | Type of activity |
| entityType | varchar(50) | Type of entity affected |
| entityId | integer | ID of affected entity |
| description | text | Human-readable description |
| metadata | jsonb | Additional context data |
| ipAddress | varchar(45) | Client IP address |
| createdAt | timestamp | When the activity occurred |

## Activity Types

| Type | Trigger | Metadata |
|------|---------|----------|
| login | User signs in | { browser, os } |
| logout | User signs out | {} |
| order_created | New order created | { invoiceNumber, customerId, grandTotal } |
| order_updated | Order status changed | { previousStatus, newStatus } |
| settlement | Payment recorded | { amount, paymentMode, orderId } |
| invoice_uploaded | Document uploaded | { fileName, fileType, provider } |
| customer_added | New customer created | { customerName, gstin } |
| product_added | New product created | { productName, erpId } |

## Querying Patterns

### Recent Activity
```sql
SELECT al.*, u.name as userName
FROM activity_logs al
LEFT JOIN users u ON al.userId = u.id
ORDER BY al.createdAt DESC
LIMIT 50;
```

### Activity by User
```sql
SELECT * FROM activity_logs
WHERE userId = $1
ORDER BY createdAt DESC;
```

### Activity by Type and Date Range
```sql
SELECT * FROM activity_logs
WHERE activityType = $1
AND createdAt BETWEEN $2 AND $3
ORDER BY createdAt DESC;
```

## Log Retention Strategy
- Active logs: Keep for 90 days in primary table
- Archive: Move older logs to archive table quarterly
- Compliance: Maintain audit trail for 7 years
- Indexing: Composite index on (userId, createdAt) and (activityType, createdAt)

## IP Address Capture
- Extract from request headers: x-forwarded-for, x-real-ip, or connection remote address
- Store IPv4 and IPv6 (varchar 45)
- Used for security audit and session tracking
