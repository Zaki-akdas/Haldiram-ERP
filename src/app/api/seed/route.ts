import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// This implies using @supabase/supabase-js for the admin client, 
// normally instantiated with a service role key.
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Forbidden in production' }, { status: 403 });
    }

    const email = 'admin@haldiram.com';
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    
    if (existing) {
      return NextResponse.json(existing);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'supabase_managed',
      email_confirm: true
    });

    if (authError) throw authError;

    const [newUser] = await db.insert(users).values({
      email,
      password: 'supabase_managed',
      name: 'Admin',
      role: 'admin',
      isActive: true
    }).returning();

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
