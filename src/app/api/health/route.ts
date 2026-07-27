import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('products').select('*').limit(1);
    return Response.json({ ok: !error });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
