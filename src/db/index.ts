import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL environment variable is required');

const globalForDb = globalThis as typeof globalThis & { __dbPool?: Pool };
export const pool = globalForDb.__dbPool ?? new Pool({ connectionString: databaseUrl });
if (process.env.NODE_ENV !== 'production') globalForDb.__dbPool = pool;

export const db = drizzle(pool, { schema });

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
