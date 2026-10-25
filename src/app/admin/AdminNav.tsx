'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Activity,
  PlayCircle,
  HelpCircle,
  Sparkles,
  ShieldAlert,
  Trophy,
  Settings,
  FileText,
  BarChart3,
} from 'lucide-react';

export const ADMIN_NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/students', label: 'Contestants (200)', icon: Users },
  { href: '/admin/monitor', label: 'Live Monitor', icon: Activity, badge: 'Live' },
  { href: '/admin/live', label: 'Arena Conductor', icon: PlayCircle },
  { href: '/admin/questions', label: 'Question Bank', icon: HelpCircle },
  { href: '/admin/questions/generate', label: 'AI Generator', icon: Sparkles },
  { href: '/admin/flags', label: 'Anti-Cheat', icon: ShieldAlert },
  { href: '/admin/results', label: 'Winners & Verification', icon: Trophy },
  { href: '/admin/settings', label: 'Settings & Backup', icon: Settings },
  { href: '/admin/audit', label: 'Audit Log', icon: FileText },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

export function AdminNav() {
  const pathname = usePathname();

  // Don't show admin nav on admin login page
  if (pathname === '/admin/login') return null;

  return (
    <div className="bg-zinc-950 border-b border-zinc-800/80 sticky top-16 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">


        {/* Scrollable Horizontal Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isExact = pathname === item.href;
            const isSubRoute =
              item.href !== '/admin/dashboard' &&
              pathname?.startsWith(item.href + '/') &&
              !ADMIN_NAV_ITEMS.some(
                (other) => other.href !== item.href && other.href.startsWith(item.href) && pathname === other.href
              );
            const isActive = isExact || isSubRoute;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/40 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-orange-400' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
