import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isManager } from '@/lib/auth';
import { db } from '@/db';
import { activityLogs } from '@/db/schema';
import { eq, desc, and, gte, lte, count } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isManager(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId');
    const activityType = searchParams.get('activityType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const offset = (page - 1) * limit;
    const conditions = [];

    if (userId) conditions.push(eq(activityLogs.userId, Number(userId)));
    if (activityType) conditions.push(eq(activityLogs.activityType, activityType as typeof activityLogs.activityType.enumValues[number]));
    
    if (startDate) conditions.push(gte(activityLogs.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(activityLogs.createdAt, new Date(endDate)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(activityLogs)
      .where(whereClause);

    const data = await db
      .select()
      .from(activityLogs)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(activityLogs.createdAt));

    return NextResponse.json({
      activities: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
