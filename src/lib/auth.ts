import { supabaseAdmin } from '@/db';
import { headers } from 'next/headers';

export async function getCurrentUser() {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');

    if (!authHeader) return null;

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return null;

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return {
      id: parseInt(data.user.id),
      email: data.user.email || '',
      name: data.user.user_metadata?.name || data.user.email || '',
      role: data.user.user_metadata?.role || 'salesperson',
      phone: data.user.user_metadata?.phone || null,
      avatar: data.user.user_metadata?.avatar || null,
      isActive: true,
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
  return role === 'manager' || role === 'admin';
}

export function isSalesperson(role: string): boolean {
  return role === 'salesperson';
}
