import { NextRequest } from 'next/server';
import { changePassword } from '@/lib/auth-session';

export async function POST(req: NextRequest) {
  return changePassword(req);
}
