'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    question: 'What is BOXX?',
    answer:
      'BOXX is a British-inspired boxing and fitness studio in Chiang Mai. Founded by Bert, who was born in Thailand and raised in the UK, we teach boxing fundamentals alongside functional strength training using premium imported equipment in a luxury boutique setting.',
  },
  {
    question: 'Do I need boxing experience?',
    answer:
      'Not at all. Our classes are open to all levels, from complete beginners to experienced boxers. Our coaches guide every participant through sessions safely and at their own pace.',
  },
  {
    question: 'Do you provide gloves and wraps?',
    answer:
      'Yes, we provide both for all classes. If you train regularly, we recommend getting your own hand wraps for hygiene. We sell premium wraps and genuine leather gloves in the studio.',
  },
  {
    question: 'How do I book a class?',
    answer:
      'Purchase a class pack online or in-studio, which gets added to your account. Use your purchase email or booking code to log in and reserve your spot in any eligible group class.',
  },
  {
    question: 'What is the cancellation policy?',
    answer:
      'Classes can be cancelled or rescheduled up to 12 hours before the start time. Cancellations within 12 hours or no-shows may incur charges.',
  },
  {
    question: 'Do you offer personal training?',
    answer:
      'Yes, we offer one-to-one and small-group personal training tailored to your individual goals. Contact us directly via WhatsApp, Instagram, or LINE to arrange sessions.',
  },
];

function FAQItem({ faq, index, isOpen, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      className={`border border-white/[0.04] transition-[border-color,background-color] duration-500 ${
        isOpen ? 'bg-white/[0.02] border-white/[0.08]' : 'hover:border-white/[0.08]'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-8 md:px-10 py-8 md:py-10 text-left group"
      >
        <div className="flex items-start gap-6 md:gap-8 pr-8">
          <span className={`text-sm md:text-base font-light transition-colors duration-300 flex-shrink-0 mt-0.5 ${
            isOpen ? 'text-accent' : 'text-white/15'
          }`}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span
            className={`text-lg md:text-xl lg:text-2xl font-medium transition-colors duration-300 ${
              isOpen ? 'text-white' : 'text-white/60 group-hover:text-white/80'
            }`}
          >
            {faq.question}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.3 }}
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
            isOpen
              ? 'border-accent text-accent'
              : 'border-white/10 text-white/20 group-hover:border-white/20'
          }`}
        >
          <span className="text-xl md:text-2xl font-light leading-none">+</span>
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-8 md:px-10 pb-10 md:pb-12 pl-[4.5rem] md:pl-[5.5rem]">
              <p className="text-white/40 text-base md:text-lg leading-[1.9] max-w-2xl">
                {faq.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQ() {
  const [openId, setOpenId] = useState(null);
  const headingRef = useRef(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-100px' });

  return (
    <section className="relative py-34 md:py-44 lg:py-52">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-[1100px] mx-auto px-10 lg:px-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16 md:mb-20">
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-accent text-xs tracking-[0.4em] uppercase mb-5"
            >
              FAQ
            </motion.p>

            <div ref={headingRef} className="overflow-hidden">
              <motion.h2
                initial={{ y: '100%' }}
                animate={headingInView ? { y: 0 } : { y: '100%' }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
              >
                Common Questions
              </motion.h2>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-white/30 text-sm md:text-base"
          >
            Can&apos;t find your answer? <button
              onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-accent hover:text-accent-dim transition-colors underline underline-offset-4"
            >Contact us</button>
          </motion.p>
        </div>

        {/* FAQ items */}
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <FAQItem
              key={i}
              faq={faq}
              index={i}
              isOpen={openId === i}
              onToggle={() => setOpenId(openId === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
