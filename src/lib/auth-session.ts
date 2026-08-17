import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient, createAdminClient } from './supabase';
import { getCurrentUser, AUTH_DB_PASSWORD_PLACEHOLDER, type AuthDeps } from './auth';
import { db as defaultDb } from '@/db';
import { users, activityLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type SessionDeps = AuthDeps;

export type BootstrapDeps = {
  db?: typeof defaultDb;
  adminClient?: {
    auth: {
      admin: {
        createUser(opts: {
          email: string;
          password: string;
          email_confirm: boolean;
          user_metadata: Record<string, unknown>;
        }): Promise<{ data: { user: { id?: string } | null }; error: { message: string } | null }>;
      };
    };
  };
};

/**
 * Core login flow used by POST /api/auth/login.
 *
 * Signing in through the SSR client stores the session in httpOnly cookies on
 * the response instead of returning the tokens to the client.
 */
export async function loginWithPassword(req: NextRequest, deps: SessionDeps = {}) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const supabase = await createRouteClient(deps.routeClientDeps);
    const database = deps.db ?? defaultDb;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return NextResponse.json({ error: error?.message || 'Login failed' }, { status: 401 });
    }

    const dbUserList = await database.select().from(users).where(eq(users.email, email));
    const dbUser = dbUserList[0];

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ error: 'Account not found or inactive' }, { status: 401 });
    }

    await database.insert(activityLogs).values({
      userId: dbUser.id,
      activityType: 'login',
      description: 'User logged in',
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        phone: dbUser.phone,
        avatar: dbUser.avatar,
        mustResetPassword: data.session.user?.user_metadata?.mustResetPassword === true,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * Core logout flow used by POST /api/auth/logout.
 *
 * Signs out through the SSR client so the httpOnly auth cookies are cleared on
 * the response. The activity log is written first, while the session is still
 * available to getCurrentUser.
 */
export async function logoutSession(req: NextRequest, deps: SessionDeps = {}) {
  try {
    const user = await getCurrentUser({ routeClientDeps: deps.routeClientDeps, db: deps.db });

    if (user) {
      const database = deps.db ?? defaultDb;
      await database.insert(activityLogs).values({
        userId: user.id,
        activityType: 'logout',
        description: 'User logged out',
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      });
    }

    const supabase = await createRouteClient(deps.routeClientDeps);
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * Core flow used by POST /api/auth/change-password.
 *
 * Requires an active session. Updates the Supabase password and clears the
 * first-login mustResetPassword flag, so the one-time bootstrap password stops
 * working and normal login resumes.
 */
export async function changePassword(req: NextRequest, deps: SessionDeps = {}) {
  try {
    const user = await getCurrentUser({ routeClientDeps: deps.routeClientDeps, db: deps.db });
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { password } = body as { password?: unknown };

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const supabase = await createRouteClient(deps.routeClientDeps);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { mustResetPassword: false },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * Core flow used by POST /api/auth/bootstrap.
 *
 * First-run bootstrap: creates the initial admin account with a random
 * one-time password and marks it for a forced password change on first login.
 * Succeeds only while the system has no users yet; afterwards it is inert, so
 * it cannot be used to overwrite or impersonate an existing installation.
 */
export async function bootstrapAdmin(deps: BootstrapDeps = {}) {
  try {
    const database = deps.db ?? defaultDb;
    const [existing] = await database.select().from(users).limit(1);
    if (existing) {
      return NextResponse.json({ error: 'System already initialized' }, { status: 409 });
    }

    const email = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@haldiram.com';
    const oneTimePassword = randomBytes(18).toString('base64url');

    const adminClient = deps.adminClient ?? createAdminClient();
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: oneTimePassword,
      email_confirm: true,
      user_metadata: { mustResetPassword: true },
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Failed to create admin in Supabase' }, { status: 500 });
    }

    await database.insert(users).values({
      email,
      password: AUTH_DB_PASSWORD_PLACEHOLDER,
      name: 'Admin',
      role: 'admin',
      isActive: true,
    });

    // The one-time password is only ever surfaced here. Log it so operators can
    // recover it if the UI is missed; it stops working after the forced reset.
    console.log('[bootstrap] Admin account created — one-time password issued:', oneTimePassword);

    return NextResponse.json({
      email,
      oneTimePassword,
      mustResetPassword: true,
      message: 'Sign in with these credentials — you will be required to set a new password.',
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}
