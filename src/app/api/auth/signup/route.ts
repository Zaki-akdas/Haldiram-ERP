import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, activityLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';

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

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const [newUser] = await db.insert(users).values({
      email: email.toLowerCase(),
      password: hashPassword(password),
      name,
      role: role as 'admin' | 'salesperson',
      phone: phone || null,
    }).returning();

    await db.insert(activityLogs).values({
      userId: newUser.id,
      activityType: 'login',
      entityType: 'user',
      entityId: newUser.id,
      description: `New account created: ${newUser.email} (${role})`,
    });

    return NextResponse.json({
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        phone: newUser.phone,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
