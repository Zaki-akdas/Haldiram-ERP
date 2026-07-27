import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { activityLogs, users } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    const [logs, countResult] = await Promise.all([
      db
        .select({
          id: activityLogs.id,
          userId: activityLogs.userId,
          userName: users.name,
          activityType: activityLogs.activityType,
          entityType: activityLogs.entityType,
          entityId: activityLogs.entityId,
          description: activityLogs.description,
          metadata: activityLogs.metadata,
          ipAddress: activityLogs.ipAddress,
          createdAt: activityLogs.createdAt,
        })
        .from(activityLogs)
        .leftJoin(users, eq(activityLogs.userId, users.id))
        .where(isAdmin ? undefined : eq(activityLogs.userId, user.id))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(activityLogs)
        .where(isAdmin ? undefined : eq(activityLogs.userId, user.id)),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total: Number(countResult[0]?.count || 0),
        totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Activity logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
