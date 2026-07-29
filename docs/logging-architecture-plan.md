# System Logging Architecture Plan
## Haldiram ERP — Comprehensive Activity Logging System

---

## 1. Objectives

- Capture every meaningful user action, system event, and backend operation.
- Enable audit trails, debugging, compliance, and security monitoring.
- Keep logging overhead minimal and storage scalable.
- Maintain privacy and security of logged data.

---

## 2. Log Categories & Data Points

### 2.1 Authentication & Authorization
| Field | Description |
|-------|-------------|
| `event` | `login_success`, `login_failed`, `logout`, `token_refresh`, `signup`, `password_reset` |
| `userId` | ID of the user (null for failed attempts) |
| `email` | Email used in attempt |
| `ipAddress` | Client IP |
| `userAgent` | Browser / device info |
| `metadata` | `{ reason: "invalid_password" }`, `{ mfa: true }` |

### 2.2 CRUD Operations (Orders, Customers, Products, Settlements)
| Field | Description |
|-------|-------------|
| `event` | `create`, `read`, `update`, `delete` |
| `entityType` | `order`, `customer`, `product`, `settlement`, `invoice` |
| `entityId` | Target record ID |
| `userId` | Actor |
| `changes` | `{ before: {...}, after: {...} }` for update/delete |
| `ipAddress` | Client IP |
| `userAgent` | Browser / device info |

### 2.3 Bill Punching & Document Extraction
| Field | Description |
|-------|-------------|
| `event` | `bill_uploaded`, `extraction_started`, `extraction_completed`, `bill_punched`, `download_csv`, `download_copy_paste` |
| `userId` | Salesperson / user |
| `fileName` | Original file name |
| `fileSize` | Bytes |
| `extractionMode` | `regex` or `ai` |
| `confidence` | Extraction confidence % |
| `itemsExtracted` | Count |
| `invoiceId` | Link to uploaded invoice (if any) |
| `error` | Error message if failed |

### 2.4 System & Backend Events
| Field | Description |
|-------|-------------|
| `event` | `server_start`, `server_stop`, `db_migration`, `cache_cleared`, `job_failed`, `job_completed` |
| `service` | `api`, `cron`, `worker`, `db` |
| `severity` | `info`, `warn`, `error`, `critical` |
| `metadata` | Stack trace, job ID, duration, affected records |

### 2.5 AI / External Service Calls
| Field | Description |
|-------|-------------|
| `event` | `ollama_request`, `ollama_response`, `ollama_error` |
| `userId` | User who triggered |
| `model` | e.g., `llama3.2:3b` |
| `promptTokens` | Token count |
| `responseTokens` | Token count |
| `latencyMs` | Response time |
| `error` | Timeout, 500, etc. |

### 2.6 API Gateway / Request-Level
| Field | Description |
|-------|-------------|
| `event` | `http_request` |
| `method` | GET, POST, etc. |
| `path` | `/api/orders` |
| `statusCode` | 200, 401, 500, etc. |
| `durationMs` | Request latency |
| `userId` | Authenticated user |
| `ipAddress` | Client IP |
| `userAgent` | Browser / device info |
| `requestId` | Correlation ID (for tracing) |

---

## 3. Unified Log Schema

```typescript
interface SystemLog {
  id: string;                    // UUID
  timestamp: DateTime;           // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'auth' | 'crud' | 'billing' | 'system' | 'ai' | 'api';
  event: string;                 // snake_case event name
  userId: number | null;
  userRole: string | null;
  entityType: string | null;     // order, customer, etc.
  entityId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;      // X-Correlation-ID
  message: string;               // Human-readable summary
  metadata: Record<string, any>; // Flexible payload
  durationMs: number | null;     // For timed operations
}
```

---

## 4. Storage Architecture

### 4.1 Hot Storage (Recent Logs — 0 to 30 days)
- **PostgreSQL** (`activity_logs` table) — already in use.
- Indexed by `timestamp`, `userId`, `category`, `event`.
- Partition by `timestamp` (monthly) for faster deletes and queries.

### 4.2 Warm Storage (30 to 90 days)
- **PostgreSQL** same table, but move old partitions to cheaper tablespace.
- Or **S3-compatible object storage** in JSONL/Parquet format.

### 4.3 Cold Storage (90+ days)
- **Amazon S3 / GCS / Azure Blob** with lifecycle policies.
- Compressed JSONL or Parquet for cost-efficient analytics.
- Can be queried via **Athena / BigQuery / Redshift Spectrum** if needed.

### 4.4 Real-time Search & Dashboards
- **Elasticsearch / OpenSearch** — full-text search, filters, dashboards.
- Alternative: **Meilisearch** for lightweight, easy setup.
- Sync via application-level writes or CDC (Change Data Capture).

### 4.5 Alerting & Metrics
- **Prometheus + Grafana** — aggregate log counts, error rates, latency.
- **Webhook / Email alerts** for critical events.

---

## 5. Implementation Plan

### Phase 1: Backend Foundation (Week 1)
1. Create a shared `logActivity()` utility in `src/lib/logging.ts`.
2. Replace all inline `supabase.from('activity_logs').insert(...)` calls with the utility.
3. Add middleware to log every API request with `requestId`, `method`, `path`, `status`, `durationMs`, `ipAddress`, `userAgent`.
4. Ensure `requestId` is generated at edge/api boundary and passed through headers.

### Phase 2: Expand Event Coverage (Week 2)
1. Add logging to all CRUD endpoints.
2. Add logging to extraction, conversion, and AI endpoints.
3. Add logging to authentication flows.
4. Add system event logging for server start/stop, migrations, errors.

### Phase 3: Storage Optimization (Week 3)
1. Enable PostgreSQL partitioning on `activity_logs` by month.
2. Add indexes: `(timestamp)`, `(userId, timestamp)`, `(category, event)`.
3. Set up TTL / archival job to move logs older than 30 days to object storage.

### Phase 4: Observability & Alerts (Week 4)
1. Stream critical logs to a webhook or alerting service.
2. Build admin dashboard to view recent logs with filters.
3. Add export functionality (CSV/JSON) for compliance.

---

## 6. Best Practices

### 6.1 Performance
- **Async writes**: Use a queue (e.g., in-memory buffer flushed every 100ms) for high-throughput apps.
- **Batch inserts**: Insert multiple logs in one query when possible.
- **Avoid logging sensitive data**: Never log raw passwords, tokens, or PII unless encrypted.
- **Sampling**: For very high-volume events (API requests), sample debug logs in production.

### 6.2 Security
- Immutable log storage — append-only, no updates/deletes by app.
- Encrypt logs at rest (PostgreSQL TDE, S3 SSE).
- Restrict access to logs to `admin` and `manager` roles only.
- Redact PII: mask email addresses partially, never log full credit card numbers.
- Use `requestId` to correlate logs without exposing raw IPs to frontend.

### 6.3 Compliance
- Retain logs for minimum required period (e.g., 90 days for audit).
- Provide export and deletion capabilities for GDPR requests.
- Document what is logged and why (privacy policy).

---

## 7. Proposed File Structure

```
src/
├── lib/
│   ├── logging.ts           # Core logger utility
│   ├── logger.middleware.ts # API request logger
│   └── log-archiver.ts      # Archives old logs to S3
├── app/
│   └── api/
│       └── activity/
│           └── route.ts     # Query logs (admin only)
└── components/
    └── ActivityLogTable.tsx # Reusable log viewer
```

---

## 8. Example Logger Utility

```typescript
// src/lib/logging.ts
import { getSupabaseAdmin } from '@/db';

export async function logActivity(params: {
  level?: string;
  category: string;
  event: string;
  userId?: number | null;
  userRole?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  message: string;
  metadata?: Record<string, any>;
  durationMs?: number | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('activity_logs').insert({
      activity_type: params.event,
      level: params.level || 'info',
      category: params.category,
      user_id: params.userId,
      user_role: params.userRole,
      entity_type: params.entityType,
      entity_id: params.entityId,
      message: params.message,
      metadata: params.metadata || {},
      duration_ms: params.durationMs,
      request_id: params.requestId,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}
```

---

## 9. Monitoring & Alerting Rules

| Rule | Condition | Action |
|------|-----------|--------|
| Auth spike | > 10 failed logins in 5 min | Email admin |
| Error rate | > 5% 5xx responses in 1 min | Slack alert |
| Extraction failure | AI extraction fails repeatedly | Notify team |
| Disk usage | PostgreSQL > 80% | Auto-archive + alert |
| Unauthorized access | Non-admin accesses `/api/activity` | Critical alert |

---

## 10. Success Metrics

- 100% of user actions logged
- Log write latency < 10ms p95
- Zero application crashes due to logging failures
- Log retention policy enforced automatically
- Full audit trail available for any record in < 2 seconds

---

*Document version: 1.0 — Created 2026-07-29*
