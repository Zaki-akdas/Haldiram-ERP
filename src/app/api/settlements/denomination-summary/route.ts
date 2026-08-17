import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { settlements } from '@/db/schema';
import { eq, gte, lte, and, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');

    const conditions = [];

    if (user.role === 'salesperson') {
      conditions.push(eq(settlements.salespersonId, user.id));
    }

    if (userId && user.role !== 'salesperson') {
      conditions.push(eq(settlements.salespersonId, Number(userId)));
    }

    if (startDate) conditions.push(gte(settlements.settledAt, new Date(startDate)));
    if (endDate) conditions.push(lte(settlements.settledAt, new Date(endDate)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rawSettlements = await db
      .select()
      .from(settlements)
      .where(whereClause)
      .orderBy(desc(settlements.settledAt));

    const denominationMap = new Map<number, { totalQuantity: number; totalValue: number }>();

    for (const s of rawSettlements) {
      const denoms: unknown = s.denominations;
      if (!Array.isArray(denoms)) continue;

      for (const d of denoms) {
        const rec = d as { denomination?: unknown; quantity?: unknown };
        const denom = Number(rec.denomination);
        const qty = Number(rec.quantity || 0);
        if (!denom || qty <= 0) continue;

        const existing = denominationMap.get(denom) || { totalQuantity: 0, totalValue: 0 };
        existing.totalQuantity += qty;
        existing.totalValue += denom * qty;
        denominationMap.set(denom, existing);
      }
    }

    const summary = Array.from(denominationMap.entries())
      .map(([denomination, data]) => ({
        denomination,
        totalQuantity: data.totalQuantity,
        totalValue: data.totalValue,
      }))
      .sort((a, b) => b.denomination - a.denomination);

    const totalCashReceived = summary.reduce((sum, d) => sum + d.totalValue, 0);

    return NextResponse.json({
      summary,
      totalCashReceived,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
