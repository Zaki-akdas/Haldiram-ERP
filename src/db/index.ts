import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

// Lazy singleton – the pool and drizzle instance are only created on first access,
// so the module can be imported during `next build` without DATABASE_URL being set.
const globalForDb = globalThis as typeof globalThis & {
  __dbPool?: Pool;
  __db?: NodePgDatabase<typeof schema>;
};

function getPool(): Pool {
  if (!globalForDb.__dbPool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL environment variable is required');
    const config: PoolConfig = { connectionString: databaseUrl };
    globalForDb.__dbPool = new Pool(config);
  }
  return globalForDb.__dbPool;
}

/** Lazy pool – connection is created on first query, not at import time. */
export const pool = {
  get connect() { return getPool().connect.bind(getPool()); },
  get query() { return getPool().query.bind(getPool()); },
  get end() { return getPool().end.bind(getPool()); },
  get totalCount() { return getPool().totalCount; },
  get idleCount() { return getPool().idleCount; },
  get waitingCount() { return getPool().waitingCount; },
} as unknown as Pool;

/** Lazy drizzle instance – created on first DB access. */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_, prop) {
    if (!globalForDb.__db) {
      globalForDb.__db = drizzle(getPool(), { schema });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalForDb.__db as any)[prop];
  },
});

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let _supabaseAdmin: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SECRET_KEY || ''
    );
  }
  return _supabaseAdmin;
}
