import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, role, phone } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: 'Email, password, name, and role are required' }, { status: 400 });
    }

    const validRoles = ['admin', 'salesperson'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role selected' }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, phone },
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Failed to create account' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Account created successfully',
      user: {
        id: parseInt(authData.user.id),
        email: authData.user.email!,
        name,
        role,
        phone: phone || null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
