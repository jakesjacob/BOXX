'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import Image from 'next/image';

const communityImages = [
  { src: '/images/studio/community.webp', alt: 'BOXX Community run club' },
  { src: '/images/studio/mirror-1.webp', alt: 'Members at the #BOXXCNX mirror' },
  { src: '/images/studio/mirror-2.webp', alt: 'Post-session selfie at BOXX' },
  { src: '/images/studio/mirror-3.webp', alt: 'Family training session at BOXX' },
];

// Grid template based on which index is featured
// [0]=top-left, [1]=top-right, [2]=bottom-left, [3]=bottom-right
const gridTemplates = [
  { cols: '2.5fr 1fr', rows: '2.5fr 1fr' },  // 0: top-left big
  { cols: '1fr 2.5fr', rows: '2.5fr 1fr' },  // 1: top-right big
  { cols: '2.5fr 1fr', rows: '1fr 2.5fr' },  // 2: bottom-left big
  { cols: '1fr 2.5fr', rows: '1fr 2.5fr' },  // 3: bottom-right big
];

export default function Community() {
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const gridRef = useRef(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-100px' });
  const gridInView = useInView(gridRef, { margin: '-100px' });
  const [featured, setFeatured] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  // Auto-cycle every 3s when visible
  useEffect(() => {
    if (!gridInView) return;
    const timer = setInterval(() => {
      setFeatured((prev) => (prev + 1) % communityImages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [gridInView]);

  const template = gridTemplates[featured];

  return (
    <section id="community" ref={sectionRef} className="relative py-34 md:py-44 lg:py-52 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-[1600px] mx-auto px-10 lg:px-20">
        {/* Header */}
        <div className="mb-16 md:mb-20">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-accent text-xs tracking-[0.4em] uppercase mb-5"
          >
            #BOXXCOMMUNITY
          </motion.p>

          <div ref={headingRef} className="overflow-hidden">
            <motion.h2
              initial={{ y: '100%' }}
              animate={headingInView ? { y: 0 } : { y: '100%' }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
            >
              More Than a Gym
            </motion.h2>
          </div>
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-24 items-center">
          {/* Image side — animated reshuffling grid */}
          <motion.div ref={gridRef} style={{ y: imageY }} className="relative">
            <div
              className="grid gap-2 aspect-square"
              style={{
                gridTemplateColumns: template.cols,
                gridTemplateRows: template.rows,
                transition: 'grid-template-columns 0.8s cubic-bezier(0.22, 1, 0.36, 1), grid-template-rows 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {communityImages.map((img, i) => {
                const isFeatured = i === featured;

                return (
                  <div
                    key={img.src}
                    onClick={() => setFeatured(i)}
                    className="relative overflow-hidden cursor-pointer group"
                  >
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      sizes="(max-width: 1024px) 50vw, 25vw"
                    />

                    {/* Dim overlay on non-featured */}
                    <div
                      className="absolute inset-0 transition-all duration-700"
                      style={{
                        background: isFeatured
                          ? 'linear-gradient(to top, rgba(10,10,10,0.4) 0%, transparent 50%)'
                          : 'rgba(0,0,0,0.35)',
                      }}
                    />

                    {/* Label on featured */}
                    <div
                      className="absolute bottom-3 left-3 transition-opacity duration-500"
                      style={{ opacity: isFeatured ? 1 : 0 }}
                    >
                      <p className="text-[10px] tracking-[0.2em] uppercase text-white/70 font-medium">
                        #BOXXCNX
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Floating BOXXRUN badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="absolute -bottom-5 right-4 lg:right-8 bg-accent text-black px-6 py-4 z-10"
            >
              <p className="text-xs tracking-[0.2em] uppercase font-bold">BOXXRUN</p>
              <p className="text-[10px] tracking-wider mt-1 opacity-60">Free Run Club</p>
            </motion.div>
          </motion.div>

          {/* Text side */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-white/50 text-base md:text-lg leading-[1.8]"
            >
              BOXX is built on three things: passion, community, and a genuine
              commitment to your growth. We believe training extends beyond physical
              results. It&apos;s about confidence, skill, and belonging.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-white/50 text-base md:text-lg leading-[1.8] mt-6"
            >
              From free community run clubs to local charity events, we&apos;re creating
              connections that go far beyond the ring. When you join BOXX, you join a
              family.
            </motion.p>

            {/* Community pillars */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-3 gap-6 mt-12 pt-10 border-t border-white/[0.06]"
            >
              {[
                { icon: '01', title: 'Connection', desc: 'Train together, grow together' },
                { icon: '02', title: 'Events', desc: 'Free community activities' },
                { icon: '03', title: 'Charity', desc: 'Giving back locally' },
              ].map((item) => (
                <div key={item.title}>
                  <p className="text-accent text-2xl font-light">{item.icon}</p>
                  <p className="text-sm font-semibold tracking-wide mt-3">{item.title}</p>
                  <p className="text-xs text-white/30 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
