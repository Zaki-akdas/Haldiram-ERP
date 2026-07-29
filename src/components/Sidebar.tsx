'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '📊', roles: ['admin', 'manager', 'salesperson'] },
  { href: '/orders', label: 'Sales Orders', icon: '📦', roles: ['admin', 'manager', 'salesperson'] },
  { href: '/customers', label: 'Customers', icon: '👥', roles: ['admin', 'manager', 'salesperson'] },
  { href: '/products', label: 'Inventory', icon: '🏷️', roles: ['admin', 'manager'] },
  { href: '/invoices', label: 'Doc Extractor', icon: '📄', roles: ['admin', 'manager', 'salesperson'] },
  { href: '/convert', label: 'File Converter', icon: '🔄', roles: ['admin', 'manager', 'salesperson'] },
  { href: '/bills', label: 'Field Punching', icon: '🧾', roles: ['salesperson'] },
  { href: '/salespeople', label: 'Team', icon: '👔', roles: ['admin', 'manager'] },
  { href: '/settlements', label: 'Collections', icon: '💰', roles: ['admin', 'manager', 'salesperson'] },
  { href: '/reports', label: 'Analytics', icon: '📈', roles: ['admin', 'manager'] },
  { href: '/activity', label: 'System Logs', icon: '📝', roles: ['admin', 'manager'] },
  { href: '/reference', label: 'Reference', icon: '📚', roles: ['admin', 'manager', 'salesperson'] },
];

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredNav = navItems.filter(item =>
    user && item.roles.includes(user.role)
  );

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 bg-white dark:bg-zinc-950
        border-r border-zinc-200 dark:border-zinc-800
        transform transition-all duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-8 pb-4">
            <div className="flex items-center gap-3 mb-1">
              <img src="/logo.png" alt="Swami Sharanam" className="h-10 w-auto" />
            </div>
            <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-[0.1em] mt-1 border-t border-zinc-100 dark:border-zinc-800 pt-1">Distribution Hub</p>
          </div>

          {/* User Profile */}
          <div className="mx-4 my-6 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl flex items-center justify-center font-black text-lg border border-emerald-200 dark:border-emerald-800">
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{user?.name || 'Guest'}</p>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">{user?.role || 'loading'}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
            <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-4 ml-4">Main Menu</p>
            <ul className="space-y-1">
              {filteredNav.map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`sidebar-link ${pathname === item.href ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-bold tracking-tight">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer / Logout */}
          <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-600 font-medium">
              Made by <span className="font-bold text-emerald-600">Zaki</span>
            </p>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 group"
            >
              <span className="group-hover:rotate-12 transition-transform">🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
