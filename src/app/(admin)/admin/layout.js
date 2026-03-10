'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

const allSidebarLinks = [
  { name: 'Dashboard', href: '/admin', icon: '🏠' },
  { name: 'Schedule', href: '/admin/schedule', icon: '📅' },
  { name: 'Activity', href: '/admin/bookings', icon: '📋' },
  { name: 'Members', href: '/admin/members', icon: '👥' },
  { name: 'Class Packs', href: '/admin/packs', icon: '📦', adminOnly: true },
  { name: 'Class Types', href: '/admin/class-types', icon: '🏷️' },
  { name: 'Instructors', href: '/admin/instructors', icon: '🥊' },
  { name: 'Emails', href: '/admin/emails', icon: '✉️' },
  { name: 'Settings', href: '/admin/settings', icon: '⚙️', adminOnly: true },
]

export default function AdminLayout({ children }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const userRole = session?.user?.role || 'admin'
  const isEmployee = userRole === 'employee'
  const sidebarLinks = isEmployee
    ? allSidebarLinks.filter((link) => !link.adminOnly)
    : allSidebarLinks

  const isActive = (href) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 bg-card border-r border-card-border flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-card-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-lg">🥊</span>
              <span className="font-bold text-foreground tracking-wide">BOXX Admin</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-8 h-8 items-center justify-center text-muted hover:text-foreground transition-colors rounded"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive(link.href)
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:text-foreground hover:bg-white/5'
              )}
              title={collapsed ? link.name : undefined}
            >
              <span className="text-base shrink-0">{link.icon}</span>
              {!collapsed && <span>{link.name}</span>}
            </Link>
          ))}
        </nav>

        {/* View site link */}
        <div className="p-2 border-t border-card-border">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            title={collapsed ? 'View Site' : undefined}
          >
            <span className="text-base shrink-0">←</span>
            {!collapsed && <span>View Site</span>}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('flex-1 flex flex-col min-w-0 overflow-x-hidden transition-all duration-300', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        {/* Top bar */}
        <header className="h-16 bg-card border-b border-card-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-10 h-10 flex flex-col justify-center items-center gap-1.5 -ml-1"
            aria-label="Open menu"
          >
            <span className="block w-5 h-[1.5px] bg-foreground" />
            <span className="block w-5 h-[1.5px] bg-foreground" />
            <span className="block w-5 h-[1.5px] bg-foreground" />
          </button>

          {/* Studio name — show on mobile too */}
          <div className="flex items-center gap-3">
            <Image
              src="/images/brand/logo-primary-white.png"
              alt="BOXX"
              width={80}
              height={32}
              className="h-5 lg:h-6 w-auto"
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-foreground">{session?.user?.name || 'Admin'}</p>
              <p className="text-xs text-muted">{session?.user?.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-xs text-muted hover:text-foreground transition-colors px-3 py-2 min-h-[36px] border border-card-border rounded"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
