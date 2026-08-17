import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, AUTH_DB_PASSWORD_PLACEHOLDER } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, name, role, phone } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }

    const userRole = role || 'salesperson';

    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Failed to create user in Supabase' }, { status: 400 });
    }

    const insertedUsers = await db.insert(users).values({
      email,
      password: AUTH_DB_PASSWORD_PLACEHOLDER,
      name,
      role: userRole,
      phone: phone || null,
    }).returning();

    return NextResponse.json(insertedUsers[0]);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}
