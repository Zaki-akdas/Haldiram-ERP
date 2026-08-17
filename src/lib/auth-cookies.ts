// Shared cookie options for Supabase auth session cookies.
//
// Kept in its own module (no `next/headers` imports) so it can be used both by
// Route Handlers (src/lib/supabase.ts) and by proxy.ts, which runs on the edge
// runtime. @supabase/ssr defaults to `httpOnly: false`, so we must opt in
// explicitly to keep the access/refresh tokens out of reach of client-side JS.
export const supabaseCookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
};
