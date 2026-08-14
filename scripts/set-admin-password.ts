import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load env vars from .env.local without printing values
function loadEnv(file: string) {
  const s = fs.readFileSync(file, 'utf8');
  const out: Record<string, string> = {};
  for (const line of s.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

async function main() {
  const env = loadEnv('.env.local');
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) { console.error('Missing SUPABASE_URL or secret key'); process.exit(1); }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const targetEmail = process.argv[2] || 'admin@haldiram.com';
  const newPassword = process.argv[3];
  if (!newPassword) { console.error('Usage: npx tsx scripts/set-admin-password.ts <email> <new-password>'); process.exit(1); }

  const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) { console.error('listUsers error:', listError.message); process.exit(1); }
  const target = listData.users.find(u => u.email === targetEmail);
  if (!target) { console.error('No auth user with email', targetEmail); process.exit(1); }

  const { data: upd, error: updError } = await admin.auth.admin.updateUserById(target.id, { password: newPassword });
  if (updError) { console.error('updateUserById error:', updError.message); process.exit(1); }
  console.log('Password updated for', upd.user.email);

  // Verify by signing in with the new password
  const { data: signIn, error: signInError } = await admin.auth.signInWithPassword({ email: targetEmail, password: newPassword });
  if (signInError) { console.error('VERIFY FAILED:', signInError.message); process.exit(1); }
  console.log('Verify OK: sign-in with new password succeeded');
}

main().catch(e => { console.error(e); process.exit(1); });
