import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { error } = await supabaseAdmin.from('products').select('*').limit(1);
    return Response.json({ ok: !error });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
