import { bootstrapAdmin } from '@/lib/auth-session';

export async function POST() {
  return bootstrapAdmin();
}
