import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isManager } from '@/lib/auth';
import { db } from '@/db';
import { products, activityLogs } from '@/db/schema';
import { eq, like, or, and, count } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    const offset = (page - 1) * limit;
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(products.name, `%${search}%`),
          like(products.erpId, `%${search}%`),
          like(products.hsnCode, `%${search}%`)
        )
      );
    }
    
    if (category) {
      conditions.push(eq(products.category, category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(products)
      .where(whereClause);

    const data = await db
      .select()
      .from(products)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(products.name);

    return NextResponse.json({
      products: data,
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
    if (!isManager(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { erpId, name, description, category, unit, mrp, basePrice, gstRate, hsnCode, stockQty } = body;

    if (!name || basePrice === undefined) {
      return NextResponse.json({ error: 'Name and basePrice are required' }, { status: 400 });
    }

    const [newProduct] = await db.insert(products).values({
      erpId,
      name,
      description,
      category,
      unit,
      mrp: mrp?.toString(),
      basePrice: basePrice.toString(),
      gstRate: gstRate?.toString() || '0',
      hsnCode,
      stockQty
    }).returning();

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'product_added',
      entityType: 'product',
      entityId: newProduct.id,
      description: `Product ${name} added`
    });

    return NextResponse.json(newProduct, { status: 201 });
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
      return NextResponse.json({ error: 'No product IDs provided' }, { status: 400 });
    }

    for (const id of ids) {
      await db.delete(products).where(eq(products.id, id));
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
