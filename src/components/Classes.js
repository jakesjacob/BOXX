'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

const classes = [
  {
    id: 'beginner',
    name: 'BOXXBEGINNER',
    level: 'Beginner',
    duration: '55 min',
    capacity: '6 max',
    rounds: '10 rounds',
    image: '/images/studio/class-boxing.webp',
    description:
      'Perfect for first-timers or anyone new to boxing. Move through shadow boxing, bag work, and 1:1 padwork with a focus on both offence and defence.',
    features: ['Shadow boxing', 'Bag work', '1:1 Padwork', 'Technique focus'],
  },
  {
    id: 'intermediate',
    name: 'BOXXINTER',
    level: 'Intermediate',
    duration: '55 min',
    capacity: '6 max',
    rounds: '12 rounds',
    image: '/images/studio/class-action.webp',
    description:
      'For those with a basic understanding of boxing fundamentals. Higher pace, higher intensity, with advanced combinations and defensive drills.',
    features: ['Advanced combos', 'Higher intensity', 'Defensive drills', 'Sparring prep'],
  },
  {
    id: 'train',
    name: 'BOXX&TRAIN',
    level: 'All Levels',
    duration: '55 min',
    capacity: '6 max',
    rounds: 'Hybrid',
    image: '/images/studio/class-train.webp',
    description:
      'The best of both worlds. Boxing meets strength and conditioning with weights, kettlebells, and bodyweight training. Build muscle, burn fat, and get fit.',
    features: ['Boxing drills', 'Kettlebells', 'Strength work', 'Fat burning'],
  },
  {
    id: 'juniors',
    name: 'BOXXJUNIORS',
    level: 'Ages 9+',
    duration: '55 min',
    capacity: '10 max',
    rounds: 'Fun focused',
    image: '/images/studio/class-juniors.webp',
    description:
      'Boxing in a safe, fun, and supportive environment. Sessions build fitness, coordination, and discipline while teaching fundamentals.',
    features: ['Coordination', 'Discipline', 'Fitness', 'Fun environment'],
  },
];

function ClassCard({ cls, index, isExpanded, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.7, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      onClick={onToggle}
      className={`group cursor-pointer relative overflow-hidden border transition-[border-color,background-color] duration-700 ${
        isExpanded
          ? 'border-accent/30 bg-card'
          : 'border-card-border bg-card/50 hover:border-white/10'
      }`}
    >
      {/* Image section */}
      <div
        className={`relative overflow-hidden transition-all duration-700 ${
          isExpanded ? 'h-56 md:h-72' : 'h-52 md:h-64'
        }`}
      >
        <Image
          src={cls.image}
          alt={cls.name}
          fill
          className={`object-cover transition-transform duration-700 ${
            isExpanded ? 'scale-105' : 'group-hover:scale-105'
          }`}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

        {/* Level badge */}
        <div className="absolute top-5 left-5 px-5 py-2.5 bg-black/60 backdrop-blur-sm border border-white/10">
          <span className="text-[11px] tracking-[0.2em] uppercase text-accent">
            {cls.level}
          </span>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-5 left-5 right-5">
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
            {cls.name}
          </h3>
          <div className="flex gap-4 mt-3">
            {[cls.duration, cls.capacity, cls.rounds].map((detail) => (
              <span key={detail} className="text-[11px] tracking-wider text-white/40">
                {detail}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pt-6 pb-7 space-y-5">
              <p className="text-white/50 text-sm leading-[1.8]">{cls.description}</p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {cls.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <div className="w-1 h-1 bg-accent rounded-full flex-shrink-0" />
                    <span className="text-sm text-white/60">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3">
                <Link
                  href="/book"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs tracking-[0.2em] uppercase text-accent hover:text-accent-dim transition-colors"
                >
                  Book this class &rarr;
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand indicator */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-card-border">
        <span className="text-[11px] tracking-wider text-white/25">
          {isExpanded ? 'Click to collapse' : 'Click to learn more'}
        </span>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-white/25 text-lg"
        >
          &#x2304;
        </motion.span>
      </div>
    </motion.div>
  );
}

export default function Classes() {
  const [expandedId, setExpandedId] = useState(null);
  const headingRef = useRef(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-100px' });

  return (
    <section id="classes" className="relative py-34 md:py-44 lg:py-52">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-[1600px] mx-auto px-10 lg:px-20">
        {/* Section header */}
        <div className="mb-16 md:mb-20">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-accent text-xs tracking-[0.4em] uppercase mb-5"
          >
            Our Classes
          </motion.p>

          <div ref={headingRef} className="overflow-hidden">
            <motion.h2
              initial={{ y: '100%' }}
              animate={headingInView ? { y: 0 } : { y: '100%' }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
            >
              Find Your Fight
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-white/40 mt-6 max-w-lg text-base md:text-lg leading-relaxed"
          >
            Small-group sessions. Maximum 6 people. Every class delivers proper
            technique, real conditioning, and 1:1 attention from UK-qualified coaches.
          </motion.p>
        </div>

        {/* Class cards grid */}
        <div className="grid md:grid-cols-2 gap-5 md:gap-6 items-start">
          {classes.map((cls, i) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              index={i}
              isExpanded={expandedId === cls.id}
              onToggle={() =>
                setExpandedId(expandedId === cls.id ? null : cls.id)
              }
            />
          ))}
        </div>

        {/* Personal training callout */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="mt-8 relative overflow-hidden border border-card-border bg-card/30 p-8 md:p-14"
        >
          <div className="grid md:grid-cols-[1fr,auto] gap-10 items-center">
            <div>
              <p className="text-accent text-xs tracking-[0.4em] uppercase mb-4">
                1-to-1 &amp; Small Group
              </p>
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                Personal Training
              </h3>
              <p className="text-white/40 max-w-lg leading-relaxed">
                Tailored sessions built around your goals, whether that&apos;s boxing
                technique, strength, weight loss, or fight preparation. Every
                programme is designed specifically for you.
              </p>
            </div>
            <button
              onClick={() => {
                document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-12 py-6 bg-cta text-[#0a0a0a] text-sm tracking-[0.2em] uppercase font-semibold hover:bg-cta-hover transition-colors duration-300 whitespace-nowrap"
            >
              Enquire Now
            </button>
          </div>

          <div className="absolute top-0 right-0 w-24 h-24 border-t border-r border-accent/10" />
        </motion.div>
      </div>
    </section>
  );
}
