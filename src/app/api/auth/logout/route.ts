import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (token) {
      const user = await getCurrentUser();

      if (user) {
        await supabase
          .from('activity_logs')
          .insert({
            user_id: user.id,
            activity_type: 'logout',
            description: `User ${user.name} logged out`,
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
          });
      }

      await supabase.auth.signOut({ scope: 'global' });
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
