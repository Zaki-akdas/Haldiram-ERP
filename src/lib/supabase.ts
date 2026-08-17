import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { supabaseCookieOptions } from './auth-cookies';

/**
 * Minimal structural contracts used by `createRouteClient`.
 *
 * They are intentionally narrower than the full `@supabase/ssr` types so that
 * tests can inject fakes without casts, while the real client still satisfies
 * them at runtime.
 */
export interface RouteCookieStore {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): void;
}

export interface RouteSessionClient {
  auth: {
    getUser(): Promise<{ data: { user: { email?: string; user_metadata?: { mustResetPassword?: boolean } } | null }; error: { message: string } | null }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: { session: { access_token: string; user?: { user_metadata?: { mustResetPassword?: boolean } } } | null }; error: { message: string } | null }>;
    updateUser(attributes: { password?: string; data?: Record<string, unknown> }): Promise<{ error: { message: string } | null }>;
    signOut(): Promise<unknown>;
  };
}

export type RouteServerClientFactory = (
  url: string,
  key: string,
  options: {
    cookieOptions: CookieOptions;
    cookies: {
      getAll(): { name: string; value: string }[];
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]): void;
    };
  }
) => RouteSessionClient;

export type RouteClientDeps = {
  cookieStore?: RouteCookieStore;
  createServerClient?: RouteServerClientFactory;
};

export async function createRouteClient(deps: RouteClientDeps = {}): Promise<RouteSessionClient> {
  const cookieStore = deps.cookieStore ?? (await cookies());
  const create = deps.createServerClient ?? (createServerClient as unknown as RouteServerClientFactory);

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return create(url, key, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server component, ignore
        }
      },
    },
  });
}

export function createAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return createClient(url, key);
}
