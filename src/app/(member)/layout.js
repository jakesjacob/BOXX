'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

const memberLinks = [
  { name: 'Book Classes', href: '/dashboard' },
  { name: 'Buy Packs', href: '/buy-classes' },
]

export default function MemberLayout({ children }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-background">
      {/* Member nav */}
      <nav className="bg-card border-b border-card-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/">
            <Image
              src="/images/brand/logo-primary-white.png"
              alt="BOXX"
              width={100}
              height={40}
              className="h-8 w-auto"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {memberLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2 text-sm rounded transition-colors',
                  pathname === link.href || pathname.startsWith(link.href + '/')
                    ? 'text-accent'
                    : 'text-muted hover:text-foreground'
                )}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted hidden sm:block">
              {session?.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-xs text-muted hover:text-foreground transition-colors px-3 py-1.5 border border-card-border rounded"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile nav - horizontal scroll */}
        <div className="md:hidden overflow-x-auto border-t border-card-border">
          <div className="flex px-4 gap-1 min-w-max">
            {memberLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3 py-2.5 text-xs whitespace-nowrap transition-colors',
                  pathname === link.href || pathname.startsWith(link.href + '/')
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-muted'
                )}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 py-8 min-h-[600px]">
        {children}
      </main>

      {/* Spacer + footer */}
      <div className="mt-16" />
      <footer className="border-t border-card-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/">
            <Image
              src="/images/brand/logo-primary-white.png"
              alt="BOXX"
              width={80}
              height={32}
              className="h-6 w-auto opacity-40"
            />
          </Link>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Book Classes</Link>
            <Link href="/buy-classes" className="hover:text-foreground transition-colors">Buy Packs</Link>
          </div>
          <p className="text-[10px] text-muted/50">&copy; {new Date().getFullYear()} BOXX Thailand</p>
        </div>
      </footer>
    </div>
  )
}
