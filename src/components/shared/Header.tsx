'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GitBranch,
  Shield,
  PlayCircle,
  LogOut,
  Trophy,
  Award,
  Tv,
  BookOpen,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  Users,
  Activity,
} from 'lucide-react';

export function Header({ studentName }: { studentName?: string }) {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith('/admin');
  const [authRole, setAuthRole] = useState<'admin' | 'student' | 'guest' | null>(null);
  const [displayName, setDisplayName] = useState<string | undefined>(studentName);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/verify')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setAuthRole(data.role);
          if (data.student?.name) setDisplayName(data.student.name);
        } else {
          setAuthRole('guest');
        }
      })
      .catch(() => setAuthRole('guest'));
  }, [studentName]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {}
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {}
    window.location.href = '/login';
  };


  const navLinks = [
    { href: '/', label: 'Home', icon: GitBranch },
    { href: '/lobby', label: 'Lobby', icon: PlayCircle },
    { href: '/final', label: 'Leaderboard', icon: Trophy },
    { href: '/projector', label: 'Projector', icon: Tv, target: '_blank' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 group-hover:scale-105 transition-transform shadow-sm">
            <GitBranch className="w-5 h-5" />
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
            SmartLink <span className="text-orange-400 font-mono">Git Quiz</span>
          </span>
        </Link>

        {/* Center Nav Links (Desktop) */}
        <div className="hidden md:flex items-center gap-2">
          <nav className="flex items-center gap-1 font-mono">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = link.href === '/' ? pathname === '/' : pathname?.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  target={link.target}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'text-orange-400 bg-orange-500/10 border border-orange-500/30 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-orange-400' : 'text-zinc-400'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Controls & Auth */}
        <div className="flex items-center gap-2">
          {authRole === 'admin' ? (
            /* Logged in as Admin */
            <div className="flex items-center gap-2">
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-1.5 text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-500/20 transition shadow-sm"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Portal</span>
              </Link>

              {/* Admin Suite Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                  className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg transition border shadow-sm ${
                    isAdminPath
                      ? 'bg-zinc-800 text-white border-zinc-700'
                      : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800 hover:border-zinc-700'
                  }`}
                  title="Organizer Tools"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {adminDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs"
                    onMouseLeave={() => setAdminDropdownOpen(false)}
                  >
                    <div className="px-2 py-1.5 text-[10px] font-mono uppercase text-zinc-500 border-b border-zinc-900">
                      Organizer Tools
                    </div>
                    <div className="py-1 space-y-0.5 font-sans">
                      <Link
                        href="/admin/dashboard"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
                        <span>Control Dashboard</span>
                      </Link>
                      <Link
                        href="/admin/monitor"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900"
                      >
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Condition Watcher</span>
                      </Link>
                      <Link
                        href="/admin/students"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>Contestant Directory</span>
                      </Link>
                      <Link
                        href="/admin/questions"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                        <span>Question Bank</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition text-xs font-mono font-medium"
                title="Log out of Admin Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : authRole === 'student' || displayName ? (
            /* Logged in as Participant */
            <div className="flex items-center gap-2">
              <Link
                href="/lobby"
                className="flex items-center gap-2 text-xs font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-800 transition"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-semibold text-orange-400">Portal:</span>
                <span className="font-medium truncate max-w-[110px]">{displayName || 'Participant'}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition text-xs font-mono font-medium"
                title="Log out of Participant Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            /* Logged Out / Guest: Show clean Login button only */
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-xs text-white bg-orange-600 hover:bg-orange-500 px-3.5 py-1.5 rounded-lg font-medium transition shadow-sm"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Login</span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 space-y-2 text-sm animate-in slide-in-from-top-2 duration-150">
          <div className="font-mono text-[10px] uppercase text-zinc-500 px-2">Navigation</div>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.href === '/' ? pathname === '/' : pathname?.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                target={link.target}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'text-orange-400 bg-orange-500/10 font-semibold'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4 text-orange-400" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          {/* Admin Suite: ONLY visible when authenticated as admin */}
          {authRole === 'admin' && (
            <>
              <div className="pt-2 border-t border-zinc-800 font-mono text-[10px] uppercase text-amber-500 px-2 flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                <span>Admin Suite</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <Link
                  href="/admin/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  📊 Dashboard
                </Link>
                <Link
                  href="/admin/monitor"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  👁️ Live Monitor
                </Link>
                <Link
                  href="/admin/students"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  👥 200 Students
                </Link>
                <Link
                  href="/admin/live"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  ⚡ Conductor
                </Link>
                <Link
                  href="/admin/questions"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  📝 Question Bank
                </Link>
                <Link
                  href="/admin/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  ⚙️ Settings & Backup
                </Link>
              </div>
            </>
          )}

          {(authRole === 'admin' || authRole === 'student' || displayName) && (
            <div className="pt-2 border-t border-zinc-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono font-medium hover:bg-rose-500/20 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
