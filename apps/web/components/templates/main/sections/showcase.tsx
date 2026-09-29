"use client";

import { m } from "motion/react";
import { Check, Store } from "lucide-react";
import Link from "next/link";

const keyFeatures = [
  { label: "Tenant Isolation (RLS / Scoped)", active: false },
  { label: "Custom Theme & Storefront Config", active: false },
  { label: "Owner Admin Portal (/{slug}/admin)", active: true },
  { label: "Atomic User & Tenant Onboarding", active: false },
  { label: "End-to-End tRPC Type Safety", active: false },
];

export default function Showcase() {
  return (
    <section id="architecture" className="mx-auto max-w-[1400px] px-6 md:px-10 mt-14">
      <m.div
        className="mesh-showcase rounded-[28px] overflow-hidden p-5 md:p-7 border border-black/5"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{
          duration: 0.6,
          ease: [0.25, 1, 0.5, 1],
        }}
      >
        <div className="grid md:grid-cols-2 gap-5">
          {/* LEFT INNER CARD */}
          <m.div
            className="relative min-h-[380px] rounded-[22px] p-6 md:p-7 text-white flex flex-col justify-between overflow-hidden shadow-xl"
            style={{ backgroundColor: "#141416" }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="px-2.5 py-1 rounded-[6px] bg-white flex items-center justify-center text-[11px] font-bold text-[#111114]">
                  Multi-Tenant
                </div>
                <span className="text-[12px] font-mono text-white/40">Drizzle + tRPC + Next.js</span>
              </div>

              <h2 className="mt-6 text-[26px] font-medium leading-[1.15] tracking-tight text-white">
                All-in-One Clinic
                <br />
                Storefront Engine
              </h2>

              <div className="mt-4">
                <p
                  className="text-[14px] font-normal leading-[21px] max-w-[320px]"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  From multi-tenant database partitioning to customizable JSON storefront configs, launch clinic portals in minutes.
                </p>
              </div>
            </div>

            {/* Key Features */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">
                Architecture Highlights
              </span>
              {keyFeatures.map((feat) => (
                <div
                  key={feat.label}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] ${
                    feat.active
                      ? "bg-white/10 text-white font-medium border border-white/15"
                      : "text-white/70"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center ${
                      feat.active ? "bg-blue-500 text-white" : "bg-white/10 text-white/40"
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span>{feat.label}</span>
                </div>
              ))}
            </div>
          </m.div>

          {/* RIGHT INNER CARD */}
          <m.div
            className="relative min-h-[380px] rounded-[22px] p-6 md:p-7 bg-white flex flex-col justify-between shadow-sm border border-border/60"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.1,
            }}
          >
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-bold">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[14px] font-semibold text-foreground block">
                      Live Clinic Showcase
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      Active Multi-Tenant Deployments
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                  Healthy
                </span>
              </div>

              <blockquote className="mt-8 text-[17px] font-medium leading-[1.4] tracking-tight text-foreground">
                &ldquo;We provisioned Cairo Heart with isolated categories, products, and owner admin with zero boilerplate.&rdquo;
              </blockquote>
            </div>

            <div className="mt-8 pt-6 border-t border-border/80 flex flex-col gap-3">
              <span className="text-[12px] font-medium text-foreground/80">Available Demo Tenants:</span>
              <div className="grid sm:grid-cols-2 gap-2">
                <Link
                  href="/cairo-heart"
                  className="p-3 rounded-xl bg-muted/50 border border-border hover:border-accent hover:bg-muted transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[13px] text-foreground group-hover:text-accent">
                      Cairo Heart
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">/cairo-heart</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Cardiology telehealth catalog
                  </p>
                </Link>

                <Link
                  href="/alexandria-pediatrics"
                  className="p-3 rounded-xl bg-muted/50 border border-border hover:border-accent hover:bg-muted transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[13px] text-foreground group-hover:text-accent">
                      Alexandria Pediatrics
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">/alexandria-pediatrics</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Family &amp; pediatric wellness care
                  </p>
                </Link>
              </div>
            </div>
          </m.div>
        </div>

        {/* STACK TICKER ROW */}
        <div className="mt-8 px-2 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 pt-6 border-t border-border/40">
          <p className="text-[12px] font-medium text-muted-foreground shrink-0">
            Powered by modern monorepo stack:
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[12px] font-mono text-foreground/80">
            <span className="px-3 py-1 rounded-full bg-white border border-border shadow-2xs">Next.js 16 (Turbopack)</span>
            <span className="px-3 py-1 rounded-full bg-white border border-border shadow-2xs">tRPC v11</span>
            <span className="px-3 py-1 rounded-full bg-white border border-border shadow-2xs">Drizzle ORM</span>
            <span className="px-3 py-1 rounded-full bg-white border border-border shadow-2xs">PostgreSQL</span>
            <span className="px-3 py-1 rounded-full bg-white border border-border shadow-2xs">Tailwind CSS v4</span>
            <span className="px-3 py-1 rounded-full bg-white border border-border shadow-2xs">TypeScript</span>
          </div>
        </div>
      </m.div>
    </section>
  );
}
