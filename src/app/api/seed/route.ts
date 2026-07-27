import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const existing = await db.select({ id: users.id }).from(users).limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ message: 'Database already seeded' });
    }

    const createdUsers: any[] = [];
    const userEmails = [
      'admin@salessettle.in',
      'manager@salessettle.in',
      'rohit@salessettle.in',
      'neha@salessettle.in',
      'arjun@salessettle.in',
      'pavan@salessettle.in',
    ];
    const userNames = ['Super Admin', 'Rahul Manager', 'Rohit Sharma', 'Neha Gupta', 'Arjun Patel', 'Pavan Jadhav'];
    const userPhones = ['9000000001', '9000000002', '9000000003', '9000000004', '9000000005', '9340208493'];
    const userRoles = ['admin', 'manager', 'salesperson', 'salesperson', 'salesperson', 'salesperson'];
    const passwords = ['admin123', 'manager123', 'rohit123', 'neha123', 'arjun123', 'pavan123'];

    for (let i = 0; i < userEmails.length; i++) {
      const [dbUser] = await db.insert(users).values({
        email: userEmails[i],
        password: hashPassword(passwords[i]),
        name: userNames[i],
        role: userRoles[i] as any,
        phone: userPhones[i],
        isActive: true,
      }).returning();
      createdUsers.push(dbUser);
    }

    return NextResponse.json({
      message: 'Database seeded successfully',
      counts: {
        users: createdUsers.length,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
