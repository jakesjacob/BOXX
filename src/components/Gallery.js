'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import Image from 'next/image';

const images = [
  { src: '/images/studio/studio-interior.webp', alt: 'BOXX Studio Interior', caption: 'The Studio', subtitle: 'Purpose-built for boxing' },
  { src: '/images/studio/class-action.webp', alt: 'Boxing Class in Action', caption: 'In Session', subtitle: 'Small groups, real coaching' },
  { src: '/images/studio/training.webp', alt: 'Training Session', caption: 'Training', subtitle: 'Strength meets technique' },
  { src: '/images/studio/storefront.webp', alt: 'BOXX Boxing Studio exterior', caption: 'The Space', subtitle: 'Chiang Mai\'s home of boxing' },
  { src: '/images/studio/pt-session.webp', alt: 'Personal Training', caption: 'Personal', subtitle: 'Tailored to your goals' },
  { src: '/images/studio/boxing-wall.webp', alt: 'Boxing memorabilia wall', caption: 'Heritage', subtitle: 'Rooted in the sport' },
];

export default function Gallery() {
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-100px' });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance every 5 seconds
  const advance = useCallback(() => {
    setActive((prev) => (prev + 1) % images.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(advance, 5000);
    return () => clearInterval(timer);
  }, [paused, advance]);

  // Pause on manual interaction, resume after 10s
  const handleSelect = (i) => {
    setActive(i);
    setPaused(true);
    setTimeout(() => setPaused(false), 10000);
  };

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const marqueeX = useTransform(scrollYProgress, [0, 1], ['0%', '-30%']);

  return (
    <section ref={sectionRef} className="relative py-34 md:py-44 lg:py-52 bg-[#080808]">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Scrolling text marquee */}
      <div className="overflow-hidden mb-16 md:mb-20">
        <motion.div style={{ x: marqueeX }} className="flex gap-12 whitespace-nowrap">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="text-7xl md:text-9xl font-bold tracking-tighter text-white/[0.025]"
            >
              BOXX STUDIO
            </span>
          ))}
        </motion.div>
      </div>

      <div className="max-w-[1600px] mx-auto px-10 lg:px-20">
        {/* Section header */}
        <div className="mb-14 md:mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-accent text-xs tracking-[0.4em] uppercase mb-5"
          >
            The Space
          </motion.p>

          <div ref={headingRef} className="overflow-hidden">
            <motion.h2
              initial={{ y: '100%' }}
              animate={headingInView ? { y: 0 } : { y: '100%' }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
            >
              Inside BOXX
            </motion.h2>
          </div>
        </div>

        {/* Expanding flex panels — desktop */}
        <div className="hidden md:flex h-[70vh] min-h-[500px] max-h-[800px] gap-2">
          {images.map((image, i) => (
            <motion.div
              key={image.src}
              onClick={() => handleSelect(i)}
              className="relative overflow-hidden cursor-pointer"
              animate={{
                flex: active === i ? 5 : 1,
              }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Image */}
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover"
                sizes={active === i ? '70vw' : '15vw'}
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Inactive state — rotated label */}
              <motion.div
                animate={{ opacity: active === i ? 0 : 1 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <p
                  className="text-sm tracking-[0.3em] uppercase text-white/60 whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  {image.caption}
                </p>
              </motion.div>

              {/* Active state — caption */}
              <motion.div
                animate={{
                  opacity: active === i ? 1 : 0,
                  y: active === i ? 0 : 20,
                }}
                transition={{ duration: 0.5, delay: active === i ? 0.3 : 0 }}
                className="absolute bottom-0 left-0 right-0 p-8 lg:p-12"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-8 h-[1px] bg-accent" />
                  <span className="text-[10px] tracking-[0.3em] uppercase text-accent">
                    {String(i + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold tracking-tight">
                  {image.caption}
                </h3>
                <p className="text-white/50 text-sm mt-3 tracking-wide">
                  {image.subtitle}
                </p>
              </motion.div>

              {/* Top-left number for inactive panels */}
              <motion.span
                animate={{ opacity: active === i ? 0 : 0.3 }}
                className="absolute top-5 left-0 right-0 text-center text-[10px] tracking-[0.2em] text-white/30"
              >
                {String(i + 1).padStart(2, '0')}
              </motion.span>
            </motion.div>
          ))}
        </div>

        {/* Mobile — stacked cards */}
        <div className="md:hidden space-y-3">
          {images.map((image, i) => (
            <motion.div
              key={image.src}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              onClick={() => handleSelect(active === i ? -1 : i)}
              className={`relative overflow-hidden cursor-pointer transition-[height] duration-700 ${
                active === i ? 'h-72' : 'h-24'
              }`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] tracking-[0.2em] text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className={`font-bold tracking-tight transition-all duration-500 ${
                    active === i ? 'text-2xl' : 'text-lg'
                  }`}>
                    {image.caption}
                  </h3>
                </div>
                {active === i && (
                  <p className="text-white/50 text-sm mt-2">{image.subtitle}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Panel indicators */}
        <div className="hidden md:flex justify-center gap-2 mt-8">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === active ? 'bg-accent w-8' : 'bg-white/15 w-2 hover:bg-white/30'
              }`}
              aria-label={`View ${images[i].caption}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
