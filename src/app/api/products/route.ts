import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin.from('products').select('*', { count: 'exact' });
    if (search) query = query.ilike('name', `%${search}%`);
    if (category) query = query.eq('category', category);

    const { data: productList, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const { data: categoriesData } = await supabaseAdmin.from('products').select('category');
    const categories = [...new Set(categoriesData?.map(c => c.category).filter(Boolean) || [])];

    return NextResponse.json({
      products: (productList || []).map(p => ({
        ...p,
        mrp: Number(p.mrp),
        basePrice: Number(p.base_price),
        gstRate: Number(p.gst_rate),
      })),
      categories,
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { erpId, name, description, category, unit, mrp, basePrice, gstRate, hsnCode, stockQty } = body;

    if (!name || !mrp || !basePrice) {
      return NextResponse.json({ error: 'Name, MRP, and base price are required' }, { status: 400 });
    }

    const { data: newProduct, error } = await supabaseAdmin
      .from('products')
      .insert({
        erp_id: erpId,
        name,
        description,
        category,
        unit: unit || 'PCS',
        mrp: mrp.toString(),
        base_price: basePrice.toString(),
        gst_rate: (gstRate || 18).toString(),
        hsn_code: hsnCode,
        stock_qty: stockQty || 0,
      })
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      activity_type: 'product_added',
      entity_type: 'product',
      entity_id: newProduct.id,
      description: `Added product ${name}`,
    });

    return NextResponse.json({ product: newProduct }, { status: 201 });
  } catch (error) {
    console.error('Product create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
