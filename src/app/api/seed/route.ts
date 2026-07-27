import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { data: existing } = await supabaseAdmin.from('users').select('id').limit(1);
    if (existing && existing.length > 0) return NextResponse.json({ message: 'Database already seeded' });

    const created = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@salessettle.in',
      password: 'admin123',
      email_confirm: true,
      user_metadata: { name: 'Super Admin', role: 'admin', phone: '9000000001' },
    });

    return NextResponse.json({ message: 'Seeded via Supabase Auth/users', user: created.data.user });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
