import { headers } from 'next/headers';
import { createAdminClient } from './supabase';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';

export async function getCurrentUser() {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    
    const supabase = createAdminClient();
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    
    if (error || !supabaseUser || !supabaseUser.email) {
      return null;
    }
    
    const email = supabaseUser.email;
    
    const dbUserList = await db.select().from(users).where(eq(users.email, email));
    const dbUser = dbUserList[0];
    
    if (!dbUser) return null;
    
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      phone: dbUser.phone,
      avatar: dbUser.avatar,
      isActive: dbUser.isActive
    };
  } catch (error) {
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
