import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, orders, customers } from '@/db/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const salespeople = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
        totalOrders: sql<number>`count(DISTINCT ${orders.id})`,
        monthlyOrders: sql<number>`count(DISTINCT ${orders.id}) filter (where ${orders.orderDate} >= ${startOfMonth})`,
        totalRevenue: sql<number>`coalesce(sum(${orders.grandTotal}), 0)`,
        monthlyRevenue: sql<number>`coalesce(sum(${orders.grandTotal}) filter (where ${orders.orderDate} >= ${startOfMonth}), 0)`,
        totalCustomers: sql<number>`count(DISTINCT ${customers.id})`,
      })
      .from(users)
      .leftJoin(orders, eq(orders.salespersonId, users.id))
      .leftJoin(customers, eq(customers.assignedSalespersonId, users.id))
      .where(eq(users.role, 'salesperson'))
      .groupBy(users.id)
      .orderBy(desc(sql`coalesce(sum(${orders.grandTotal}), 0)`));

    return NextResponse.json({
      salespeople: salespeople.map(sp => ({
        ...sp,
        totalRevenue: Number(sp.totalRevenue),
        monthlyRevenue: Number(sp.monthlyRevenue),
      })),
    });
  } catch (error) {
    console.error('Salespeople fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admin can create salespeople' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, name, phone } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const [newUser] = await db.insert(users).values({
      email: email.toLowerCase(),
      password,
      name,
      phone,
      role: 'salesperson',
    }).returning({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error('Salesperson create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
