'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function CTABanner() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);

  return (
    <section ref={ref} className="relative h-[50vh] md:h-[60vh] min-h-[400px] overflow-hidden">
      {/* Parallax background */}
      <motion.div style={{ y }} className="absolute inset-0 scale-110">
        <Image
          src="/images/studio/studio-interior.webp"
          alt="BOXX Studio"
          fill
          className="object-cover"
          sizes="100vw"
        />
      </motion.div>

      {/* Overlays */}
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-accent text-xs tracking-[0.4em] uppercase mb-8"
        >
          Your Journey Starts Here
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1]"
        >
          Ready to Step
          <br />
          Into the Ring?
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <Link
            href="/book"
            target="_blank"
            className="px-14 py-6 bg-cta text-[#0a0a0a] text-sm tracking-[0.2em] uppercase font-semibold hover:bg-cta-hover transition-colors duration-300 text-center"
          >
            Book a Class
          </Link>
          <a
            href="https://wa.me/66934972306"
            target="_blank"
            rel="noopener noreferrer"
            className="px-14 py-6 border border-white/20 text-sm tracking-[0.2em] uppercase hover:bg-white/5 transition-all duration-300 text-center"
          >
            WhatsApp Us
          </a>
        </motion.div>
      </div>
    </section>
  );
}
