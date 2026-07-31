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

  const filteredNav = navItems.filter(item => user && item.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed left-0 top-0 z-50 h-full w-72 border-r border-slate-800/80 bg-slate-950 text-slate-100 shadow-[20px_0_60px_-20px_rgba(2,6,23,0.65)] transition-all duration-300 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          <div className="p-7 pb-4">
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3">
              <img src="/logo-icon.svg" alt="Swami Sharanam" className="h-10 w-auto" />
            </div>
            <p className="mt-2 border-t border-slate-800 pt-2 text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Distribution Hub</p>
          </div>

          <div className="mx-4 my-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-lg font-black text-blue-300">
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{user?.name || 'Guest'}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-400">{user?.role || 'loading'}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
            <p className="mb-4 ml-4 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Main Menu</p>
            <ul className="space-y-1">
              {filteredNav.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={onClose} className={`sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
                      <span className="text-lg">{item.icon}</span>
                      <span className="font-bold tracking-tight">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="space-y-3 border-t border-slate-800 p-6">
            <p className="text-center text-[10px] font-medium text-slate-500">
              Built for <span className="font-bold text-blue-400">operational clarity</span>
            </p>
            <button onClick={handleLogout} className="group flex w-full items-center gap-3 rounded-2xl border border-slate-800 px-4 py-3 text-sm font-bold text-rose-400 transition-all duration-200 hover:bg-rose-500/10">
              <span className="transition-transform group-hover:rotate-12">🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
