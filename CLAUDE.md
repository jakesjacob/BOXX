# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — ESLint (flat config, Next.js preset)

## Architecture

Single-page Next.js 16 app (App Router) with no routing beyond the root page. All content is in `src/app/page.js`, which composes 14 section components in order:

LoadingScreen → Navbar → Hero → MarqueeBanner → About → Features → Classes → Gallery → Testimonials → Community → Process → CTABanner → FAQ → Contact → Footer

- **Components:** `src/components/` — all client components using Framer Motion for scroll animations
- **Styling:** Tailwind CSS v4 with `@theme inline` in `src/app/globals.css` defining custom colors as CSS variables
- **Utility:** `src/lib/utils.js` — `cn()` function (clsx + tailwind-merge) for conditional class merging
- **Layout:** `src/app/layout.js` — root layout with Geist font and SEO metadata
- **Dynamic OG/Favicon:** `src/app/opengraph-image.js` and `src/app/icon.js` generate images at build time using `sharp`

## Design Tokens (globals.css)

Use Tailwind classes mapped to these CSS variables — do not use raw hex values:

| Tailwind class    | Variable         | Value    |
|-------------------|------------------|----------|
| `bg-background`   | `--background`   | #0a0a0a  |
| `text-foreground` | `--foreground`   | #f5f5f5  |
| `text-accent`     | `--accent`       | #c8a750  |
| `text-accent-dim` | `--accent-dim`   | #a08535  |
| `bg-cta`          | `--cta`          | #f5efe6  |
| `bg-cta-hover`    | `--cta-hover`    | #e8dfd2  |
| `text-muted`      | `--muted`        | #888888  |
| `bg-card`         | `--card`         | #111111  |
| `border-card-border` | `--card-border` | #1a1a1a |

## Brand Reference

Full brand doc at `docs/brand-reference.md` — includes founder bio, class descriptions, testimonials, contact info, and image inventory.

## Task Tracking

All task tracking lives in **`docs/dev-spec.md`** — this is the single source of truth. Read it at the start of each session and update it after completing features.

## Key Conventions

- JavaScript only (no TypeScript)
- All components are client-side (`"use client"`) with Framer Motion animations
- Images are WebP in `public/images/studio/` and `public/images/brand/`
- Use `cn()` from `@/lib/utils` for combining Tailwind classes
- Dark luxury aesthetic: black backgrounds, white text, gold (#c8a750) accents
