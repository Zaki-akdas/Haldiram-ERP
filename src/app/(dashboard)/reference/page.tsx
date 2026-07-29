'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  {
    title: 'Sales Orders',
    items: [
      { label: 'Create Order', href: '/orders/new' },
      { label: 'View All Orders', href: '/orders' },
    ],
  },
  {
    title: 'Field Punching (Bills)',
    items: [
      { label: 'New Bill Entry', href: '/bills' },
      { label: 'AI / Smart Extraction', href: '/bills' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { label: 'Customer List', href: '/customers' },
      { label: 'Add Customer', href: '/customers' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Products / ERP IDs', href: '/products' },
      { label: 'Add Product', href: '/products' },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'Doc Extractor (Invoices)', href: '/invoices' },
      { label: 'File Converter', href: '/invoices' },
    ],
  },
  {
    title: 'Collections',
    items: [
      { label: 'Settlements', href: '/settlements' },
      { label: 'Orders with Balance', href: '/orders' },
    ],
  },
  {
    title: 'Reports & Logs',
    items: [
      { label: 'Analytics', href: '/reports' },
      { label: 'System Activity Logs', href: '/activity' },
    ],
  },
];

export default function ReferencePage() {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Quick Reference</h1>
        <p className="text-slate-500 dark:text-slate-400">Navigate to any module instantly</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4"
          >
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              {section.title}
            </h3>
            <ul className="space-y-2">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
