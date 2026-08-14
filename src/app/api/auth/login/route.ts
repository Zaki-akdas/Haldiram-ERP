import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, activityLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json({ error: error?.message || 'Login failed' }, { status: 401 });
    }

    const dbUserList = await db.select().from(users).where(eq(users.email, email));
    const dbUser = dbUserList[0];

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ error: 'Account not found or inactive' }, { status: 401 });
    }

    await db.insert(activityLogs).values({
      userId: dbUser.id,
      activityType: 'login',
      description: 'User logged in',
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      token: data.session.access_token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        phone: dbUser.phone,
        avatar: dbUser.avatar,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}
