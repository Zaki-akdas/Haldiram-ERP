import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sessions, activityLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (token) {
      const user = await getCurrentUser();

      await db.delete(sessions).where(eq(sessions.token, token));

      if (user) {
        await db.insert(activityLogs).values({
          userId: user.id,
          activityType: 'logout',
          description: `User ${user.name} logged out`,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
