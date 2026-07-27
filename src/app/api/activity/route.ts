import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    let query = supabase
      .from('activity_logs')
      .select('*, users(name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (!isAdmin) query = query.eq('user_id', user.id);

    const { data: logs, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return NextResponse.json({
      logs: logs || [],
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    console.error('Activity logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
