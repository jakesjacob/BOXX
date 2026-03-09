'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import Image from 'next/image';

function RevealText({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <div ref={ref} className="overflow-hidden">
      <motion.div
        initial={{ y: '100%' }}
        animate={inView ? { y: 0 } : { y: '100%' }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}

function CountUp({ value, suffix = '', duration = 1.5 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const target = parseInt(value, 10);
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setDisplay(target);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, (duration * 1000) / steps);
    return () => clearInterval(timer);
  }, [inView, value, duration]);

  return (
    <span ref={ref}>
      {inView ? display : 0}{suffix}
    </span>
  );
}

function FadeIn({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function About() {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <section id="about" ref={sectionRef} className="relative py-34 md:py-44 lg:py-52">
      <div className="max-w-[1600px] mx-auto px-10 lg:px-20">
        <FadeIn>
          <p className="text-accent text-xs tracking-[0.4em] uppercase mb-5">
            Our Story
          </p>
        </FadeIn>

        <div className="grid lg:grid-cols-2 gap-20 lg:gap-32 items-start">
          {/* Left — Text */}
          <div>
            <RevealText>
              <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
                Born in Thailand.
                <br />
                <span className="text-accent">Trained in Britain.</span>
              </h2>
            </RevealText>

            <FadeIn delay={0.2}>
              <p className="text-white/50 text-base md:text-lg leading-[1.9] mt-14 hidden md:block">
                Founded by Bert, born in Thailand and raised in Glasgow, BOXX brings
                over a decade of UK personal training expertise to Chiang Mai. After
                qualifying in Central London and building a career across boxing,
                strength training, and nutrition, Bert returned to Thailand with one
                mission.
              </p>
              <p className="text-white/50 text-base leading-[1.9] mt-10 md:hidden">
                Founded by Bert — born in Thailand, raised in Glasgow — BOXX brings a decade of UK coaching expertise to Chiang Mai.
              </p>
            </FadeIn>

            {/* Image + quote — mobile only, inline */}
            <div className="md:hidden mt-10">
              <div className="relative">
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    src="/images/studio/about-bert.webp"
                    alt="Bert, founder of BOXX"
                    fill
                    className="object-cover scale-[1.3] object-[70%_15%]"
                    sizes="100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
                </div>

                <div className="bg-card border border-card-border p-6 -mt-8 relative mx-4">
                  <div className="text-accent text-2xl font-serif leading-none mb-2">&ldquo;</div>
                  <p className="text-sm text-white/70 italic leading-[1.8]">
                    More than a PT. He&apos;s a coach, a guide, and a partner in your growth.
                  </p>
                  <div className="w-8 h-[1px] bg-accent mt-4 mb-2" />
                  <p className="text-[9px] tracking-[0.3em] uppercase text-white/30">
                    Client Review
                  </p>
                </div>
              </div>
            </div>

            <FadeIn delay={0.3}>
              <p className="text-white/50 text-base md:text-lg leading-[1.9] mt-8 hidden md:block">
                To create a space where Western boxing standards meet Thai warmth. Where
                technique comes first, classes stay intimate, and every person who walks
                through the door feels like they belong.
              </p>
              <p className="text-white/50 text-base leading-[1.9] mt-8 md:hidden">
                Western boxing standards meet Thai warmth — technique first, intimate classes, and a space where everyone belongs.
              </p>
            </FadeIn>

            {/* Stats */}
            <FadeIn delay={0.4}>
              <div className="grid grid-cols-3 gap-10 mt-20 pt-12 border-t border-white/[0.06]">
                {[
                  { number: 10, suffix: '+', label: 'Years Experience' },
                  { number: 6, suffix: '', label: 'Max Per Class' },
                  { number: 4, suffix: '', label: 'Class Types' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-4xl md:text-5xl font-bold text-accent">
                      <CountUp value={stat.number} suffix={stat.suffix} />
                    </p>
                    <p className="text-[11px] md:text-xs tracking-wider uppercase text-white/30 mt-3">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>

          {/* Right — Image with parallax (desktop only) */}
          <div className="relative mt-4 lg:mt-0 hidden md:block">
            <motion.div style={{ y: imageY }} className="relative">
              <div className="relative aspect-[3/4] overflow-hidden">
                <Image
                  src="/images/studio/about-bert.webp"
                  alt="Bert, founder of BOXX"
                  fill
                  className="object-cover scale-150 object-[70%_15%]"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                {/* Edge blending gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-l from-[#0a0a0a]/60 via-transparent to-[#0a0a0a]/60" />
              </div>

              {/* Quote card — positioned on the right */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="absolute -bottom-8 -right-4 lg:-right-8 bg-card border border-card-border p-10 lg:p-12 max-w-[360px]"
              >
                <div className="text-accent text-4xl font-serif leading-none mb-4">&ldquo;</div>
                <p className="text-base md:text-lg text-white/70 italic leading-[1.8]">
                  More than a PT. He&apos;s a coach, a guide, and a partner in
                  your growth.
                </p>
                <div className="w-10 h-[1px] bg-accent mt-8 mb-4" />
                <p className="text-[10px] tracking-[0.3em] uppercase text-white/30">
                  Client Review
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
