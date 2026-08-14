import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { customers, users, activityLogs } from '@/db/schema';
import { eq, like, and, or, count } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const salespersonId = searchParams.get('salespersonId');

    const offset = (page - 1) * limit;

    const conditions = [];

    if (user.role === 'salesperson') {
      conditions.push(eq(customers.assignedSalespersonId, user.id));
    } else if (salespersonId) {
      conditions.push(eq(customers.assignedSalespersonId, Number(salespersonId)));
    }

    if (search) {
      conditions.push(
        or(
          like(customers.name, `%${search}%`),
          like(customers.phone, `%${search}%`),
          like(customers.email, `%${search}%`),
          like(customers.city, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(customers)
      .where(whereClause);

    const rows = await db
      .select()
      .from(customers)
      .leftJoin(users, eq(customers.assignedSalespersonId, users.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(customers.name);

    const data = rows.map(({ customers: c, users: sp }) => ({
      ...c,
      outstanding: c.outstandingBalance,
      salespersonName: sp?.name || null,
    }));

    return NextResponse.json({
      customers: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, phone, email, gstin, pan, address, city, state, pincode, beat, creditLimit, assignedSalespersonId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
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
      creditLimit: creditLimit ? creditLimit.toString() : null,
      assignedSalespersonId
    }).returning();

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'customer_added',
      entityType: 'customer',
      entityId: newCustomer.id,
      description: `Customer ${name} added`
    });

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map(Number) : (body?.id ? [Number(body.id)] : []);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No customer IDs provided' }, { status: 400 });
    }

    for (const id of ids) {
      await db.delete(customers).where(eq(customers.id, id));
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
