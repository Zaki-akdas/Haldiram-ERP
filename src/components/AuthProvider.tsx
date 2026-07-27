'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'salesperson';
  phone?: string | null;
  avatar?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'salessettle_token';

// Safe localStorage helpers (in case storage is blocked in iframe)
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignored
  }
}

function removeToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignored
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokenState, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper: make an authenticated fetch
  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const t = tokenState || getToken();
    const newHeaders: Record<string, string> = {};
    
    // Copy existing headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => { newHeaders[key] = value; });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => { newHeaders[key] = value; });
      } else {
        Object.assign(newHeaders, options.headers);
      }
    }
    
    if (t) {
      newHeaders['Authorization'] = `Bearer ${t}`;
    }
    return fetch(url, { ...options, headers: newHeaders });
  }, [tokenState]);

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const savedToken = getToken();
        if (!savedToken) {
          setUser(null);
          setLoading(false);
          return;
        }
        setTokenState(savedToken);

        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${savedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          removeToken();
          setUser(null);
          setTokenState(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }));
        return { success: false, error: data.error || `Login failed (${res.status})` };
      }

      const data = await res.json();

      if (data.token && data.user) {
        setStoredToken(data.token);
        setTokenState(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: 'Invalid server response' };
      }
    } catch (err) {
      return { success: false, error: 'Network error: ' + (err instanceof Error ? err.message : String(err)) };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const t = tokenState || getToken();
      if (t) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${t}` },
        }).catch(() => {});
      }
    } finally {
      removeToken();
      setTokenState(null);
      setUser(null);
    }
  }, [tokenState]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
