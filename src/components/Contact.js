'use client';

import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';

const socialLinks = [
  { name: 'Instagram', href: 'https://instagram.com/boxxthailand' },
  { name: 'TikTok', href: 'https://tiktok.com/@boxxthailand' },
  { name: 'Facebook', href: 'https://web.facebook.com/profile.php?id=61584385442693' },
  { name: 'WhatsApp', href: 'https://wa.me/66934972306' },
  { name: 'LINE', href: '#' },
];

export default function Contact() {
  const headingRef = useRef(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-100px' });
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    interest: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      {/* Contact Info Section */}
      <section id="contact" className="relative py-34 md:py-44 lg:py-52 bg-[#080808]">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="max-w-[1600px] mx-auto px-10 lg:px-20">
          <div className="grid lg:grid-cols-2 gap-20 lg:gap-32">
            {/* Left — Heading + Details */}
            <div>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-accent text-xs tracking-[0.4em] uppercase mb-6"
              >
                Get In Touch
              </motion.p>

              <div ref={headingRef} className="overflow-hidden">
                <motion.h2
                  initial={{ y: '100%' }}
                  animate={headingInView ? { y: 0 } : { y: '100%' }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight"
                >
                  Ready to <span className="text-accent">Start?</span>
                </motion.h2>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="mt-8 text-white/40 text-base md:text-lg leading-[1.9] max-w-lg"
              >
                Whether you&apos;re a complete beginner or a seasoned boxer, we&apos;d
                love to hear from you. Drop us a message or find us on social media.
              </motion.p>

              {/* Storefront image */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.25 }}
                className="mt-12 relative aspect-[16/9] overflow-hidden"
              >
                <Image
                  src="/images/studio/about-1.webp"
                  alt="BOXX Boxing Studio entrance in Chiang Mai"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/60 via-transparent to-transparent" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="mt-10 space-y-10"
              >
                <div>
                  <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-3">
                    Location
                  </p>
                  <p className="text-white/60 text-lg leading-relaxed">
                    89/2 Bumruang Road, Wat Ket
                    <br />
                    Chiang Mai 50000, Thailand
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-3">
                      Email
                    </p>
                    <a
                      href="mailto:hello@boxxthailand.com"
                      className="text-white/60 text-lg hover:text-accent transition-colors"
                    >
                      hello@boxxthailand.com
                    </a>
                  </div>

                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-3">
                      Phone
                    </p>
                    <a
                      href="tel:+66934972306"
                      className="text-white/60 text-lg hover:text-accent transition-colors"
                    >
                      +66 93 497 2306
                    </a>
                  </div>
                </div>
              </motion.div>

              {/* Social links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="mt-14 flex flex-wrap gap-3"
              >
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group px-6 py-3 border border-white/[0.06] hover:border-accent/30 transition-all duration-300"
                  >
                    <span className="text-xs tracking-[0.15em] text-white/40 group-hover:text-accent transition-colors">
                      {link.name}
                    </span>
                  </a>
                ))}
              </motion.div>
            </div>

            {/* Right — Form */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              {submitted ? (
                <div className="h-full min-h-[500px] flex items-center justify-center border border-white/[0.04] bg-[#0c0c0c]">
                  <div className="text-center px-10">
                    <div className="w-16 h-16 border border-accent rounded-full flex items-center justify-center mx-auto mb-10">
                      <span className="text-accent text-2xl">&#10003;</span>
                    </div>
                    <h3 className="text-3xl font-bold mb-5">Message Sent</h3>
                    <p className="text-white/40 text-lg leading-relaxed">
                      Thanks for reaching out.<br />We&apos;ll get back to you within 24 hours.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] tracking-[0.3em] uppercase text-white/25 mb-4">
                        First Name
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formState.firstName}
                        onChange={handleChange}
                        required
                        className="w-full bg-[#0c0c0c] border border-white/[0.06] px-5 py-4 text-white/80 text-base focus:border-accent/50 focus:outline-none transition-colors placeholder:text-white/15"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] tracking-[0.3em] uppercase text-white/25 mb-4">
                        Last Name
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formState.lastName}
                        onChange={handleChange}
                        required
                        className="w-full bg-[#0c0c0c] border border-white/[0.06] px-5 py-4 text-white/80 text-base focus:border-accent/50 focus:outline-none transition-colors placeholder:text-white/15"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-[0.3em] uppercase text-white/25 mb-4">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formState.email}
                      onChange={handleChange}
                      required
                      className="w-full bg-[#0c0c0c] border border-white/[0.06] px-5 py-4 text-white/80 text-base focus:border-accent/50 focus:outline-none transition-colors placeholder:text-white/15"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] tracking-[0.3em] uppercase text-white/25 mb-4">
                        Phone
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formState.phone}
                        onChange={handleChange}
                        className="w-full bg-[#0c0c0c] border border-white/[0.06] px-5 py-4 text-white/80 text-base focus:border-accent/50 focus:outline-none transition-colors placeholder:text-white/15"
                        placeholder="+66 XX XXX XXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] tracking-[0.3em] uppercase text-white/25 mb-4">
                        Interested In
                      </label>
                      <select
                        name="interest"
                        value={formState.interest}
                        onChange={handleChange}
                        className="w-full bg-[#0c0c0c] border border-white/[0.06] px-5 py-4 text-white/80 text-base focus:border-accent/50 focus:outline-none transition-colors appearance-none"
                      >
                        <option value="" className="bg-[#0c0c0c]">Select an option</option>
                        <option value="classes" className="bg-[#0c0c0c]">Group Classes</option>
                        <option value="pt" className="bg-[#0c0c0c]">Personal Training</option>
                        <option value="other" className="bg-[#0c0c0c]">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-[0.3em] uppercase text-white/25 mb-4">
                      Message
                    </label>
                    <textarea
                      name="message"
                      value={formState.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full bg-[#0c0c0c] border border-white/[0.06] px-5 py-4 text-white/80 text-base focus:border-accent/50 focus:outline-none transition-colors resize-none placeholder:text-white/15"
                      placeholder="How can we help?"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-6 bg-cta text-[#0a0a0a] text-sm tracking-[0.2em] uppercase font-semibold hover:bg-cta-hover transition-colors duration-300 mt-4"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
