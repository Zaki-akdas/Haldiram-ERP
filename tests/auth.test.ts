import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';
import type { RouteServerClientFactory, RouteCookieStore } from '@/lib/supabase';
import type { db } from '@/db';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

type FakeAuthConfig = {
  supabaseUser?: { email?: string; user_metadata?: { mustResetPassword?: boolean } } | null;
  getUserError?: { message: string } | null;
  signInSession?: { access_token: string } | null;
  sessionUserMetadata?: { mustResetPassword?: boolean };
  signInError?: { message: string } | null;
  updateUserError?: { message: string } | null;
};

/**
 * A fake `createServerClient` that records the cookie options it was given and
 * simulates what the real @supabase/ssr does: on a successful sign-in it writes
 * the session cookie through `cookies.setAll`; on sign-out it clears it by
 * writing a maxAge-0 cookie. This exercises the real wiring inside
 * `createRouteClient` (setAll -> cookie store).
 */
function makeFakeSupabase(config: FakeAuthConfig = {}) {
  let capturedSetAll: ((cookies: { name: string; value: string; options?: CookieOptions }[]) => void) | null = null;
  let capturedCookieOptions: CookieOptions | null = null;
  const updateUserCalls: { password?: string; data?: Record<string, unknown> }[] = [];

  const factory: RouteServerClientFactory = (_url, _key, options) => {
    capturedCookieOptions = options.cookieOptions;
    capturedSetAll = options.cookies.setAll;
    return {
      auth: {
        getUser: async () => ({
          data: { user: config.supabaseUser ?? null },
          error: config.getUserError ?? null,
        }),
        signInWithPassword: async () => {
          if (config.signInSession && capturedSetAll) {
            capturedSetAll([
              { name: 'sb-fake-auth-token', value: config.signInSession.access_token, options: capturedCookieOptions ?? undefined },
            ]);
          }
          return {
            data: {
              session: config.signInSession
                ? { access_token: config.signInSession.access_token, user: { user_metadata: config.sessionUserMetadata } }
                : null,
            },
            error: config.signInError ?? null,
          };
        },
        updateUser: async (attributes: { password?: string; data?: Record<string, unknown> }) => {
          updateUserCalls.push(attributes);
          return { error: config.updateUserError ?? null };
        },
        signOut: async () => {
          if (capturedSetAll) {
            capturedSetAll([
              { name: 'sb-fake-auth-token', value: '', options: { ...(capturedCookieOptions ?? {}), maxAge: 0 } },
            ]);
          }
        },
      },
    };
  };

  return { factory, getCookieOptions: () => capturedCookieOptions, updateUserCalls };
}

/** In-memory cookie store with real-world deletion semantics (maxAge 0 removes). */
function makeCookieStore(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  const store: RouteCookieStore = {
    getAll: () => Array.from(data.entries()).map(([name, value]) => ({ name, value })),
    set: (name, value, options) => {
      if (options?.maxAge === 0) data.delete(name);
      else data.set(name, value);
    },
  };
  return {
    store,
    has: (name: string) => data.has(name),
    values: () => Array.from(data.values()),
  };
}

type DbRow = {
  id: number;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  avatar: string | null;
  isActive: boolean | null;
};

function makeFakeDb(rows: DbRow[]) {
  const inserts: unknown[] = [];
  const fakeDb = {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(rows),
        limit: () => Promise.resolve(rows),
      }),
    }),
    insert: () => ({
      values: async (values: unknown) => {
        inserts.push(values);
      },
    }),
  };
  return { db: fakeDb as unknown as typeof db, inserts };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_ROW: DbRow = {
  id: 1,
  email: 'admin@haldiram.com',
  name: 'Admin',
  role: 'admin',
  phone: null,
  avatar: null,
  isActive: true,
};

const ACTIVE_EMAIL = ADMIN_ROW.email;

function loginRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function logoutRequest(): NextRequest {
  return new NextRequest('http://localhost/api/auth/logout', { method: 'POST' });
}

// The modules under test import @/db, which requires DATABASE_URL at load time
// (it never connects, since every db call is injected). Set env vars and import
// dynamically so the mocks can be registered before any code runs.
let loginWithPassword: typeof import('@/lib/auth-session')['loginWithPassword'];
let logoutSession: typeof import('@/lib/auth-session')['logoutSession'];
let changePassword: typeof import('@/lib/auth-session')['changePassword'];
let bootstrapAdmin: typeof import('@/lib/auth-session')['bootstrapAdmin'];
let getCurrentUser: typeof import('@/lib/auth')['getCurrentUser'];

before(async () => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';

  ({ loginWithPassword, logoutSession, changePassword, bootstrapAdmin } = await import('@/lib/auth-session'));
  ({ getCurrentUser } = await import('@/lib/auth'));
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

test('login success writes an httpOnly session cookie and returns only the user', async () => {
  const { store, has, values } = makeCookieStore();
  const supabase = makeFakeSupabase({
    supabaseUser: { email: ACTIVE_EMAIL },
    signInSession: { access_token: 'access-token' },
  });
  const { db: fakeDb, inserts } = makeFakeDb([ADMIN_ROW]);

  const res = await loginWithPassword(loginRequest({ email: ACTIVE_EMAIL, password: 'secret' }), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.user, {
    id: 1,
    email: ACTIVE_EMAIL,
    name: 'Admin',
    role: 'admin',
    phone: null,
    avatar: null,
    mustResetPassword: false,
  });
  // No token material may reach the client.
  assert.equal(body.user.access_token, undefined);
  assert.equal(body.session, undefined);

  // The session cookie flowed through createRouteClient -> cookie store.
  assert.equal(has('sb-fake-auth-token'), true);
  assert.equal(values()[0], 'access-token');

  // The cookie options handed to the Supabase SSR client are httpOnly + lax.
  const opts = supabase.getCookieOptions();
  assert.ok(opts);
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, 'lax');
  assert.equal(opts.path, '/');
  assert.equal(opts.secure, process.env.NODE_ENV === 'production');

  // A login activity log entry was written.
  assert.equal(inserts.length, 1);
  assert.equal((inserts[0] as { activityType: string }).activityType, 'login');
});

test('login rejects invalid credentials without writing any cookie', async () => {
  const { store, has } = makeCookieStore();
  const supabase = makeFakeSupabase({
    signInError: { message: 'Invalid login credentials' },
    signInSession: null,
  });
  const { db: fakeDb, inserts } = makeFakeDb([ADMIN_ROW]);

  const res = await loginWithPassword(loginRequest({ email: ACTIVE_EMAIL, password: 'wrong' }), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'Invalid login credentials');
  assert.equal(has('sb-fake-auth-token'), false);
  assert.equal(inserts.length, 0);
});

test('login rejects missing email/password with 400', async () => {
  const { store } = makeCookieStore();
  const supabase = makeFakeSupabase();
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const res = await loginWithPassword(loginRequest({ email: '', password: '' }), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Email and password are required');
});

test('login rejects a valid Supabase session with no matching or inactive DB user', async () => {
  const { store } = makeCookieStore();
  const supabase = makeFakeSupabase({
    supabaseUser: { email: 'ghost@example.com' },
    signInSession: { access_token: 'access-token' },
  });
  const { db: fakeDb } = makeFakeDb([]);

  const res = await loginWithPassword(loginRequest({ email: 'ghost@example.com', password: 'secret' }), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'Account not found or inactive');
});

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

test('getCurrentUser returns null without a session (no cookies / auth error)', async () => {
  const { store } = makeCookieStore();
  const supabase = makeFakeSupabase({ getUserError: { message: 'Auth session missing' } });
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const user = await getCurrentUser({
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });
  assert.equal(user, null);
});

test('getCurrentUser returns null when no user is found in the DB', async () => {
  const { store } = makeCookieStore({ 'sb-fake-auth-token': 'access-token' });
  const supabase = makeFakeSupabase({ supabaseUser: { email: 'nobody@example.com' } });
  const { db: fakeDb } = makeFakeDb([]);

  const user = await getCurrentUser({
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });
  assert.equal(user, null);
});

test('getCurrentUser returns the app user for a valid session', async () => {
  const { store } = makeCookieStore({ 'sb-fake-auth-token': 'access-token' });
  const supabase = makeFakeSupabase({ supabaseUser: { email: ACTIVE_EMAIL } });
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const user = await getCurrentUser({
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.deepEqual(user, {
    id: 1,
    email: ACTIVE_EMAIL,
    name: 'Admin',
    role: 'admin',
    phone: null,
    avatar: null,
    isActive: true,
    mustResetPassword: false,
  });
});

test('getCurrentUser swallows unexpected errors and returns null', async () => {
  const { store } = makeCookieStore({ 'sb-fake-auth-token': 'access-token' });
  const supabase = makeFakeSupabase({
    getUserError: { message: 'boom' },
  });
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const user = await getCurrentUser({
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });
  assert.equal(user, null);
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

test('logout clears the session cookie and subsequent requests are unauthenticated', async () => {
  const { store, has } = makeCookieStore({ 'sb-fake-auth-token': 'access-token' });
  const supabase = makeFakeSupabase({ supabaseUser: { email: ACTIVE_EMAIL } });
  const { db: fakeDb, inserts } = makeFakeDb([ADMIN_ROW]);

  const res = await logoutSession(logoutRequest(), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).success, true);

  // The auth cookie was removed through the route client wiring.
  assert.equal(has('sb-fake-auth-token'), false);

  // A logout activity log entry was written while the session was still valid.
  assert.equal(inserts.length, 1);
  assert.equal((inserts[0] as { activityType: string }).activityType, 'logout');

  // From now on, getCurrentUser sees no session.
  const afterLogout = makeFakeSupabase({ supabaseUser: null });
  const user = await getCurrentUser({
    routeClientDeps: { cookieStore: store, createServerClient: afterLogout.factory },
    db: fakeDb,
  });
  assert.equal(user, null);
});

test('logout is idempotent for already-unauthenticated sessions', async () => {
  const { store } = makeCookieStore();
  const supabase = makeFakeSupabase({ supabaseUser: null });
  const { db: fakeDb, inserts } = makeFakeDb([ADMIN_ROW]);

  const res = await logoutSession(logoutRequest(), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).success, true);
  assert.equal(inserts.length, 0);
});

// ---------------------------------------------------------------------------
// First-login password reset
// ---------------------------------------------------------------------------

test('login reports mustResetPassword when the session user is marked for reset', async () => {
  const { store } = makeCookieStore();
  const supabase = makeFakeSupabase({
    supabaseUser: { email: ACTIVE_EMAIL },
    signInSession: { access_token: 'access-token' },
    sessionUserMetadata: { mustResetPassword: true },
  });
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const res = await loginWithPassword(loginRequest({ email: ACTIVE_EMAIL, password: 'secret' }), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.mustResetPassword, true);
});

test('getCurrentUser surfaces mustResetPassword from the Supabase user metadata', async () => {
  const { store } = makeCookieStore({ 'sb-fake-auth-token': 'access-token' });
  const supabase = makeFakeSupabase({
    supabaseUser: { email: ACTIVE_EMAIL, user_metadata: { mustResetPassword: true } },
  });
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const user = await getCurrentUser({
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });
  assert.equal(user?.mustResetPassword, true);
});

function passwordRequest(password: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/change-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

test('changePassword requires an authenticated session', async () => {
  const { store } = makeCookieStore();
  const supabase = makeFakeSupabase({ getUserError: { message: 'Auth session missing' } });
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const res = await changePassword(passwordRequest('newpass123'), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 401);
  assert.equal(supabase.updateUserCalls.length, 0);
});

test('changePassword rejects passwords shorter than 8 characters', async () => {
  const { store } = makeCookieStore({ 'sb-fake-auth-token': 'access-token' });
  const supabase = makeFakeSupabase({ supabaseUser: { email: ACTIVE_EMAIL } });
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const res = await changePassword(passwordRequest('short'), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 400);
  assert.equal(supabase.updateUserCalls.length, 0);
});

test('changePassword updates the password and clears the reset flag', async () => {
  const { store } = makeCookieStore({ 'sb-fake-auth-token': 'access-token' });
  const supabase = makeFakeSupabase({ supabaseUser: { email: ACTIVE_EMAIL } });
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const res = await changePassword(passwordRequest('newpass123'), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).success, true);
  assert.deepEqual(supabase.updateUserCalls, [
    { password: 'newpass123', data: { mustResetPassword: false } },
  ]);
});

test('changePassword surfaces updateUser failures', async () => {
  const { store } = makeCookieStore({ 'sb-fake-auth-token': 'access-token' });
  const supabase = makeFakeSupabase({
    supabaseUser: { email: ACTIVE_EMAIL },
    updateUserError: { message: 'Password update failed' },
  });
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);

  const res = await changePassword(passwordRequest('newpass123'), {
    routeClientDeps: { cookieStore: store, createServerClient: supabase.factory },
    db: fakeDb,
  });

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Password update failed');
});

// ---------------------------------------------------------------------------
// First-run bootstrap
// ---------------------------------------------------------------------------

function makeFakeAdmin() {
  const createUserCalls: {
    email: string;
    password: string;
    email_confirm: boolean;
    user_metadata: Record<string, unknown>;
  }[] = [];
  const adminClient = {
    auth: {
      admin: {
        createUser: async (opts: {
          email: string;
          password: string;
          email_confirm: boolean;
          user_metadata: Record<string, unknown>;
        }) => {
          createUserCalls.push(opts);
          return { data: { user: { id: 'admin-uuid' } }, error: null };
        },
      },
    },
  };
  return { adminClient, createUserCalls };
}

test('bootstrapAdmin creates the admin with a random one-time password and reset flag', async () => {
  const { db: fakeDb, inserts } = makeFakeDb([]);
  const { adminClient, createUserCalls } = makeFakeAdmin();

  const res = await bootstrapAdmin({ db: fakeDb, adminClient });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.email, 'admin@haldiram.com');
  assert.equal(body.mustResetPassword, true);
  assert.equal(typeof body.oneTimePassword, 'string');
  assert.ok(body.oneTimePassword.length >= 16);

  // The one-time password is random, exactly what was issued, and the account
  // is flagged for a forced reset on first login.
  assert.equal(createUserCalls.length, 1);
  assert.equal(createUserCalls[0].email, 'admin@haldiram.com');
  assert.equal(createUserCalls[0].password, body.oneTimePassword);
  assert.equal(createUserCalls[0].email_confirm, true);
  assert.deepEqual(createUserCalls[0].user_metadata, { mustResetPassword: true });

  // A matching app user row was inserted (with the placeholder, never the real
  // password) and no activity log rows were written.
  assert.equal(inserts.length, 1);
  assert.equal((inserts[0] as { password: string }).password, 'managed-by-supabase-auth');
});

test('bootstrapAdmin is inert once the system has users', async () => {
  const { db: fakeDb } = makeFakeDb([ADMIN_ROW]);
  const { adminClient, createUserCalls } = makeFakeAdmin();

  const res = await bootstrapAdmin({ db: fakeDb, adminClient });

  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'System already initialized');
  assert.equal(createUserCalls.length, 0);
});
