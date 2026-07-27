import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products, activityLogs } from '@/db/schema';
import { eq, desc, ilike, sql } from 'drizzle-orm';
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
    const category = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let productList = await db.select().from(products).orderBy(desc(products.createdAt)).limit(limit).offset(offset);

    if (search) {
      productList = await db.select().from(products).where(ilike(products.name, `%${search}%`)).orderBy(desc(products.createdAt)).limit(limit).offset(offset);
    }
    if (category) {
      productList = await db.select().from(products).where(eq(products.category, category)).orderBy(desc(products.createdAt)).limit(limit).offset(offset);
    }

    const categoriesRaw = await db.select({ category: products.category }).from(products);
    const categories = [...new Set(categoriesRaw.map(c => c.category).filter(Boolean))];

    const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(products);

    return NextResponse.json({
      products: productList.map(p => ({
        ...p,
        mrp: Number(p.mrp),
        basePrice: Number(p.basePrice),
        gstRate: Number(p.gstRate),
      })),
      categories,
      pagination: {
        page,
        limit,
        total: Number(countRow?.count || 0),
        totalPages: Math.ceil(Number(countRow?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { erpId, name, description, category, unit, mrp, basePrice, gstRate, hsnCode, stockQty } = body;

    if (!name || !mrp || !basePrice) {
      return NextResponse.json({ error: 'Name, MRP, and base price are required' }, { status: 400 });
    }

    const [newProduct] = await db.insert(products).values({
      erpId,
      name,
      description,
      category,
      unit: unit || 'PCS',
      mrp: mrp.toString(),
      basePrice: basePrice.toString(),
      gstRate: (gstRate || 18).toString(),
      hsnCode,
      stockQty: stockQty || 0,
    }).returning();

    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'product_added',
      entityType: 'product',
      entityId: newProduct.id,
      description: `Added product ${name}`,
    });

    return NextResponse.json({ product: newProduct }, { status: 201 });
  } catch (error) {
    console.error('Product create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
