import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, orders, activityLogs } from '@/db/schema';
import { eq, desc, sql, and, ilike, gte, lte } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    const customerList = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        gstin: customers.gstin,
        pan: customers.pan,
        address: customers.address,
        city: customers.city,
        state: customers.state,
        pincode: customers.pincode,
        beat: customers.beat,
        creditLimit: customers.creditLimit,
        outstandingBalance: customers.outstandingBalance,
        assignedSalespersonId: customers.assignedSalespersonId,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset);

    let total = customerList.length;
    if (isAdmin) {
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(customers);
      total = Number(countRow?.count || 0);
    }

    const formattedCustomers = customerList.map(c => ({
      ...c,
      salespersonName: null,
      creditLimit: Number(c.creditLimit),
      outstandingBalance: Number(c.outstandingBalance),
    }));

    return NextResponse.json({
      customers: formattedCustomers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Customers fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      phone,
      email,
      gstin,
      pan,
      address,
      city,
      state,
      pincode,
      beat,
      creditLimit,
      assignedSalespersonId,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const [newCustomer] = await db.insert(customers).values({
      name,
      phone,
      email,
      gstin,
      pan,
      address,
      city,
      state,
      pincode,
      beat,
      creditLimit: creditLimit?.toString() || '0',
      assignedSalespersonId: assignedSalespersonId || (user.role === 'salesperson' ? user.id : null),
    }).returning();

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'customer_added',
      entityType: 'customer',
      entityId: newCustomer.id,
      description: `Added customer ${name}`,
    });

    return NextResponse.json({ customer: newCustomer }, { status: 201 });
  } catch (error) {
    console.error('Customer create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
