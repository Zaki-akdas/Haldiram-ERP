import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { headers } from 'next/headers';
import crypto from 'crypto';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

export async function getCurrentUser() {
  try {
    const hdrs = await headers();
    const authHeader = hdrs.get('authorization');
    
    if (!authHeader) return null;
    
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return null;

    const result = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        avatar: users.avatar,
        isActive: users.isActive,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.token, token),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);

    return result[0] || null;
  } catch {
    return null;
  }
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function authenticateUser(email: string, password: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  const user = result[0];

  if (!user || !verifyPassword(password, user.password)) {
    return null;
  }

  if (!user.isActive) {
    return null;
  }

  return user;
}

export type UserRole = 'admin' | 'manager' | 'salesperson';

export function canAccess(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

export function isManager(role: UserRole): boolean {
  return role === 'manager' || role === 'admin';
}

export function isSalesperson(role: UserRole): boolean {
  return role === 'salesperson';
}
