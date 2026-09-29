"use client";

import { m } from "motion/react";
import {
  ShieldCheck,
  Layers,
  Palette,
  KeyRound,
  ShoppingBag,
  Globe,
  FileCheck2,
  Database,
} from "lucide-react";

const capabilities = [
  { label: "Row-Level Tenant Isolation", icon: ShieldCheck },
  { label: "tRPC End-to-End Type Safety", icon: Layers },
  { label: "Configurable Storefronts", icon: Palette },
  { label: "Strict RBAC Admin Guards", icon: KeyRound },
  { label: "Isolated Product Catalogs", icon: ShoppingBag },
  { label: "Dynamic Sub-path Routing", icon: Globe },
  { label: "Prescription Workflows", icon: FileCheck2 },
  { label: "Postgres + Drizzle ORM", icon: Database },
];

export default function Intelligence() {
  return (
    <section id="features" className="py-24 md:py-28 mesh-intelligence overflow-hidden">
      <div className="px-6 md:px-10 mx-auto max-w-[1400px]">
        <div className="max-w-5xl mx-auto">
          <m.p
            className="text-center text-[12px] font-medium tracking-[0.18em] uppercase text-muted-foreground mb-3"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            Built for Multi-Tenant Scale
          </m.p>
          <m.h2
            className="text-center text-[36px] md:text-[52px] font-medium tracking-[-0.03em] leading-[1.08] text-foreground"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            Multi-tenancy architecture
            <br />
            <span className="text-foreground/30">engineered from first principles.</span>
          </m.h2>
        </div>

        <m.div
          className="mt-12 md:mt-16 max-w-4xl mx-auto flex flex-wrap justify-center gap-2.5 md:gap-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          {capabilities.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <m.span
                key={cap.label}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] md:text-[14px] font-medium border ${
                  i === 0
                    ? "text-accent border-accent/30 shadow-xs"
                    : "text-foreground border-black/8"
                }`}
                style={{
                  background:
                    i === 0
                      ? "linear-gradient(164deg, rgba(55,60,90,0.20) 14.62%, rgba(55,60,90,0.06) 85.2%)"
                      : "linear-gradient(164deg, rgba(0,0,0,0.02) 14.62%, rgba(0,0,0,0.04) 85.2%)",
                  backdropFilter: "blur(16px)",
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.35,
                  delay: 0.04 * i,
                }}
              >
                <Icon className="w-4 h-4 text-accent" />
                {cap.label}
              </m.span>
            );
          })}
        </m.div>

        <m.p
          className="mt-8 text-center text-[13px] md:text-[14px] leading-relaxed max-w-xl mx-auto text-muted-foreground"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          Every tenant runs isolated database queries, cryptographically secure sessions,
          and role-based tRPC middleware. Clinic owners only ever access data belonging to their own clinic.
        </m.p>
      </div>
    </section>
  );
}
