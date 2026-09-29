"use client";

import { m } from "motion/react";
import { ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";

export default function CTA() {
  return (
    <section className="relative py-24 md:py-32 mesh-cta overflow-hidden border-t border-border/50">
      <div className="px-6 md:px-10 mx-auto max-w-[1400px] text-center">
        <m.p
          className="text-[12px] font-medium tracking-[0.18em] uppercase text-muted-foreground mb-3"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          Instant Tenant Provisioning
        </m.p>
        <m.h2
          className="text-[36px] md:text-[60px] font-medium tracking-[-0.03em] leading-[1.08] text-foreground max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          Ready to launch your clinic&apos;s
          <br />
          <span className="text-foreground/30">isolated storefront?</span>
        </m.h2>

        <m.div
          className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.15,
          }}
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
      </div>
    </section>
  );
}
