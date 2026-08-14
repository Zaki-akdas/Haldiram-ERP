import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isManager } from '@/lib/auth';
import { db } from '@/db';
import { users, orders } from '@/db/schema';
import { eq, inArray, count, sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isManager(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const salespeopleList = await db
      .select()
      .from(users)
      .where(inArray(users.role, ['salesperson', 'manager']));

    const activeSalespeople = salespeopleList.filter(sp => sp.isActive);

    const salespeople = await Promise.all(
      activeSalespeople.map(async (sp) => {
        const [{ orderCount }] = await db.select({ orderCount: count() }).from(orders).where(eq(orders.salespersonId, sp.id));
        const [{ totalRevenue }] = await db.select({ totalRevenue: sql<number>`sum(CAST(${orders.grandTotal} AS DECIMAL))` }).from(orders).where(eq(orders.salespersonId, sp.id));
        
        return {
          ...sp,
          orderCount,
          totalRevenue: totalRevenue || 0
        };
      })
    );

    return NextResponse.json({ salespeople });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, email, password, phone } = body;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    const [newUser] = await db.insert(users).values({
      email,
      password: 'supabase_managed',
      name,
      phone,
      role: 'salesperson',
      isActive: true
    }).returning();

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
