import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = {
      id: parseInt(data.user.id),
      email: data.user.email || '',
      name: data.user.user_metadata?.name || data.user.email || '',
      role: data.user.user_metadata?.role || 'salesperson',
      phone: data.user.user_metadata?.phone || null,
      avatar: data.user.user_metadata?.avatar || null,
      isActive: true,
    };

    return NextResponse.json({ token: data.session.access_token, user });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
