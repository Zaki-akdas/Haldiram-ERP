import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { activityLogs } from '@/db/schema';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (user) {
      await db.insert(activityLogs).values({
        userId: user.id,
        activityType: 'logout',
        description: 'User logged out',
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}
