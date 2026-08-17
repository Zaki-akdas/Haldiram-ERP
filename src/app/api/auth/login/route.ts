import { NextRequest } from 'next/server';
import { loginWithPassword } from '@/lib/auth-session';

export async function POST(req: NextRequest) {
  return loginWithPassword(req);
}
