'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import ThemeProvider, { useTheme } from '@/components/ThemeProvider'
import {
  LayoutDashboard,
  CalendarDays,
  Activity,
  Users,
  Package,
  Tag,
  Dumbbell,
  BarChart3,
  Mail,
  Sparkles,
  Settings,
  ChevronsLeft,
  ArrowLeft,
  Zap,
  Leaf,
  Music,
  Target,
} from 'lucide-react'

const VERTICAL_ICONS = {
  boxing: Zap,
  yoga: Leaf,
  fitness: Dumbbell,
  dance: Music,
  pt: Target,
  other: Sparkles,
}

const assistantLink = { name: 'AI Assistant', href: '/admin/assistant', icon: Sparkles, adminOnly: true }

const allSidebarLinks = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Schedule', href: '/admin/schedule', icon: CalendarDays },
  { name: 'Activity', href: '/admin/bookings', icon: Activity },
  { name: 'Members', href: '/admin/members', icon: Users },
  { name: 'Products', href: '/admin/packs', icon: Package, adminOnly: true },
  { name: 'Events', href: '/admin/class-types', icon: Tag },
  { name: 'Instructors', href: '/admin/instructors', icon: Dumbbell },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Emails', href: '/admin/emails', icon: Mail },
  { name: 'Settings', href: '/admin/settings', icon: Settings, adminOnly: true },
]

function AdminLayoutInner({ children }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const userRole = session?.user?.role || 'member'
  const isOwner = userRole === 'owner'
  const isEmployee = userRole === 'employee'
  const sidebarLinks = isEmployee
    ? allSidebarLinks.filter((link) => !link.adminOnly)
    : allSidebarLinks

  const isActive = (href) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const studioName = theme?.studioName || 'Studio'
  const logoUrl = theme?.logoUrl
  const VerticalIcon = VERTICAL_ICONS[theme?.vertical] || Dumbbell

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
            <div className="flex items-center gap-2 min-w-0">
              {logoUrl ? (
                <Image src={logoUrl} alt={studioName} width={80} height={32} className="h-6 w-auto object-contain" />
              ) : (
                <>
                  <VerticalIcon className="w-5 h-5 text-accent shrink-0" />
                  <span className="font-bold text-foreground tracking-wide tenant-title truncate">{studioName}</span>
                </>
              )}
            </div>
          )}
          {collapsed && (
            <VerticalIcon className="w-5 h-5 text-accent mx-auto" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-8 h-8 items-center justify-center text-muted hover:text-foreground transition-colors rounded"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronsLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>

        {/* AI Assistant button */}
        {!isEmployee && (
          <div className="px-2 pt-4 pb-2">
            <Link
              href={assistantLink.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive(assistantLink.href)
                  ? 'bg-accent text-background shadow-lg shadow-accent/20'
                  : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 hover:border-accent/30'
              )}
              title={collapsed ? assistantLink.name : undefined}
            >
              <Sparkles className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{assistantLink.name}</span>}
            </Link>
          </div>
        )}

        {/* Separator */}
        <div className="px-4">
          <div className="border-b border-card-border" />
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
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
              <link.icon className="w-[18px] h-[18px] shrink-0" />
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
            <ArrowLeft className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>View Site</span>}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('flex-1 flex flex-col min-w-0 overflow-x-hidden h-screen transition-all duration-300', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        {/* Top bar */}
        <header className="h-16 bg-card border-b border-card-border flex items-center justify-between px-4 lg:px-6 fixed top-0 left-0 right-0 z-30">
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
            {logoUrl ? (
              <Image src={logoUrl} alt={studioName} width={80} height={32} className="h-5 lg:h-6 w-auto object-contain" />
            ) : (
              <span className="font-bold text-foreground tracking-wide tenant-title">{studioName}</span>
            )}
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
        <main className="flex-1 min-h-0 p-4 lg:p-6 pt-20 lg:pt-22 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }) {
  return (
    <ThemeProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </ThemeProvider>
  )
}
