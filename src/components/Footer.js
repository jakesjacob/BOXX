'use client';

import Image from 'next/image';
import Link from 'next/link';

const footerLinks = [
  {
    title: 'Studio',
    links: [
      { name: 'About', href: '#about' },
      { name: 'Classes', href: '#classes' },
      { name: 'Community', href: '#community' },
      { name: 'Contact', href: '#contact' },
    ],
  },
  {
    title: 'Members',
    links: [
      { name: 'Book a Class', href: '/book', route: true },
      { name: 'Buy Class Packs', href: '/buy-classes', route: true },
      { name: 'Member Login', href: '/login', route: true },
      { name: 'My Dashboard', href: '/dashboard', route: true },
    ],
  },
  {
    title: 'Classes',
    links: [
      { name: 'BOXXBEGINNER', href: '#classes' },
      { name: 'BOXXINTER', href: '#classes' },
      { name: 'BOXX&TRAIN', href: '#classes' },
      { name: 'BOXXJUNIORS', href: '#classes' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { name: 'Instagram', href: 'https://instagram.com/boxxthailand', external: true },
      { name: 'TikTok', href: 'https://tiktok.com/@boxxthailand', external: true },
      { name: 'Facebook', href: 'https://web.facebook.com/profile.php?id=61584385442693', external: true },
      { name: 'WhatsApp', href: 'https://wa.me/66934972306', external: true },
    ],
  },
];

export default function Footer() {
  const scrollTo = (href) => {
    if (href.startsWith('#')) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="relative border-t border-white/[0.04]">
      <div className="max-w-[1600px] mx-auto px-10 lg:px-20 pt-24 md:pt-28 pb-16">
        {/* Top row — Logo + tagline + link columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 md:gap-10">
          {/* Brand */}
          <div className="md:col-span-5 lg:col-span-5">
            <Image
              src="/images/brand/logo-primary-white.png"
              alt="BOXX"
              width={120}
              height={48}
              className="h-8 md:h-10 w-auto mb-6"
            />
            <p className="text-base text-white/30 leading-[1.8] max-w-[340px]">
              Chiang Mai&apos;s luxury boutique boxing and personal training
              studio. UK-qualified coaches, intimate classes, premium space.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-3 mt-6">
              <a href="https://instagram.com/boxxthailand" target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center border border-white/[0.08] text-white/30 hover:text-accent hover:border-accent/30 transition-all duration-300" aria-label="Instagram">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
              </a>
              <a href="https://tiktok.com/@boxxthailand" target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center border border-white/[0.08] text-white/30 hover:text-accent hover:border-accent/30 transition-all duration-300" aria-label="TikTok">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.17v-3.4a4.85 4.85 0 01-1-.19V6.69h1z" /></svg>
              </a>
              <a href="https://web.facebook.com/profile.php?id=61584385442693" target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center border border-white/[0.08] text-white/30 hover:text-accent hover:border-accent/30 transition-all duration-300" aria-label="Facebook">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
              <a href="https://wa.me/66934972306" target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center border border-white/[0.08] text-white/30 hover:text-accent hover:border-accent/30 transition-all duration-300" aria-label="WhatsApp">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="md:col-span-7 lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {footerLinks.map((col) => (
              <div key={col.title}>
                <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-6">
                  {col.title}
                </p>
                <ul className="space-y-4">
                  {col.links.map((link) => (
                    <li key={link.name}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-white/40 hover:text-accent transition-colors duration-300"
                        >
                          {link.name}
                        </a>
                      ) : link.route ? (
                        <Link
                          href={link.href}
                          className="text-sm text-white/40 hover:text-accent transition-colors duration-300"
                        >
                          {link.name}
                        </Link>
                      ) : (
                        <button
                          onClick={() => scrollTo(link.href)}
                          className="text-sm text-white/40 hover:text-accent transition-colors duration-300"
                        >
                          {link.name}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mt-20 pt-10 border-t border-white/[0.04]">
          {/* Contact details row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12">
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-white/20 mb-2">Address</p>
              <p className="text-sm text-white/30 leading-relaxed">
                89/2 Bumruang Road, Wat Ket<br />
                Chiang Mai 50000, Thailand
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-white/20 mb-2">Email</p>
              <a href="mailto:hello@boxxthailand.com" className="text-sm text-white/30 hover:text-accent transition-colors">
                hello@boxxthailand.com
              </a>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-white/20 mb-2">Phone</p>
              <a href="tel:+66934972306" className="text-sm text-white/30 hover:text-accent transition-colors">
                +66 93 497 2306
              </a>
            </div>
          </div>

          {/* Copyright bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/[0.03]">
            <p className="text-[11px] text-white/15 tracking-wider">
              &copy; {new Date().getFullYear()} BOXX Boxing Studio. All rights reserved.
            </p>
            <p className="text-[11px] text-white/15 tracking-[0.3em]">
              #BOXXCNX
            </p>
          </div>
        </div>
      </div>

      {/* Large background text */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden pointer-events-none">
        <p className="text-[14rem] md:text-[22rem] font-bold tracking-tighter leading-none text-white/[0.012] text-center translate-y-1/3">
          BOXX
        </p>
      </div>
    </footer>
  );
}
