import { createRouteClient, type RouteClientDeps } from './supabase';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';

// The users.password column is not used for authentication (Supabase Auth owns
// credentials); it only satisfies the NOT NULL constraint. Never store real
// passwords there.
export const AUTH_DB_PASSWORD_PLACEHOLDER = 'managed-by-supabase-auth';

export type AuthDeps = {
  routeClientDeps?: RouteClientDeps;
  db?: typeof db;
};

export async function getCurrentUser(deps: AuthDeps = {}) {
  try {
    // Reads the session from the httpOnly auth cookies and transparently
    // refreshes the access token when it has expired (via the refresh cookie).
    const supabase = await createRouteClient(deps.routeClientDeps);
    const database = deps.db ?? db;
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();

    if (error || !supabaseUser || !supabaseUser.email) {
      return null;
    }

    const email = supabaseUser.email;

    const dbUserList = await database.select().from(users).where(eq(users.email, email));
    const dbUser = dbUserList[0];

    if (!dbUser) return null;

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      phone: dbUser.phone,
      avatar: dbUser.avatar,
      isActive: dbUser.isActive,
      // True when the account was bootstrapped with a one-time password and the
      // user must set their own password before using the app.
      mustResetPassword: supabaseUser.user_metadata?.mustResetPassword === true
    };
  } catch {
    return null;
  }
}

export function canAccess(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole);
}

export function isAdmin(role: string): boolean {
  return role === 'admin';
}

export function isManager(role: string): boolean {
  return role === 'admin' || role === 'manager';
}

export function isSalesperson(role: string): boolean {
  return role === 'salesperson';
}
