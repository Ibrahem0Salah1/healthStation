"use client";

import { m } from "motion/react";
import { ArrowRight, Sparkles, Building2 } from "lucide-react";
import Link from "next/link";

export default function Hero() {
  return (
    <section id="overview" className="mx-auto max-w-[1400px] px-6 md:px-10 pt-14 md:pt-20 text-center">
      <m.div
        className="inline-flex items-center gap-[10px] rounded-[8px] px-[12px] py-[5px] eyebrow-bg border border-black/5"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="inline-flex items-center justify-center w-[24px] h-[22px] rounded-[4px] bg-white text-foreground shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
        </span>
        <span className="text-[13px] font-medium text-foreground">
          Multi-Tenant Telehealth &amp; Clinic Storefront Platform
        </span>
      </m.div>

      <m.h1
        className="mx-auto max-w-[1100px] mt-6 font-medium leading-[1.08] tracking-[-0.035em] text-[48px] md:text-[68px] text-foreground"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      >
        <div>Launch your clinic storefront</div>
        <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-2">
          <span>with zero</span>
          {/*
            The video that used to sit here was a hotlink to
            `qclay.design/lovable/nixole/nurse-video.mp4` — a third-party
            asset in a first-party hero. Removed for three reasons:

            1. LEAKAGE. Every visitor to the landing page sent a request to a
               host we do not control, exposing their IP and user agent. On a
               telehealth site that is a needless disclosure.
            2. AVAILABILITY. The file is not ours. It can be deleted, moved or
               rate-limited, and the hero would render a broken video box
               with no error surfaced to us.
            3. PERFORMANCE. A remote MP4 with `autoPlay` is an unbounded
               download competing with the LCP element it sits inside.

            A decorative inline SVG is the right substitute here: it is
            zero-request, always renders, and cannot break. A real product
            photo would need to be committed to `public/` — which is a
            separate decision from removing someone else's asset.
          */}
          <span className="relative inline-flex items-center align-middle">
            <svg
              viewBox="0 0 76 76"
              className="w-[60px] h-[60px] md:w-[76px] md:h-[76px]"
              role="img"
              aria-label="A clinician consultation"
            >
              <defs>
                <linearGradient id="hero-orb" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              <circle cx="38" cy="38" r="36" fill="url(#hero-orb)" />
              <circle cx="38" cy="38" r="35.5" fill="white" stroke="var(--color-border)" />

              {/* Stethoscope: the telehealth motif, drawn rather than downloaded. */}
              <path
                d="M27 24v11a8 8 0 0 0 16 0V24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M35 43v3a7 7 0 0 0 14 0v-2"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="49" cy="40" r="3.5" fill="var(--accent)" />
            </svg>
          </span>
          <span className="text-foreground/30">DevOps overhead</span>
        </div>
      </m.h1>

      <m.p
        className="mx-auto mt-6 max-w-[680px] text-[16px] leading-[1.6] text-muted-foreground"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        One unified engine, infinite branded telehealth storefronts. Get an isolated clinic
        sub-path, custom theme, medical product catalog, and dedicated owner admin portal in under 2 minutes.
      </m.p>

      <m.div
        className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      >
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-7 py-3 text-[14px] font-semibold shadow-sm hover:bg-foreground/90 transition-all hover:gap-3"
        >
          <span>Sign Up New Tenant</span>
          <ArrowRight className="w-4 h-4" />
        </Link>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-6 py-3 text-[14px] font-medium text-foreground shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-muted transition-colors"
        >
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span>Clinic Owner Login</span>
        </Link>
      </m.div>

      <m.div
        className="mt-8 flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <span className="text-foreground/60 font-medium">Explore live demo clinics:</span>
        <Link
          href="/cairo-heart"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-border/80 text-foreground hover:border-accent hover:text-accent transition-colors font-mono text-[11px]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          /cairo-heart
        </Link>
        <Link
          href="/alexandria-pediatrics"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-border/80 text-foreground hover:border-accent hover:text-accent transition-colors font-mono text-[11px]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          /alexandria-pediatrics
        </Link>
      </m.div>
    </section>
  );
}
