"use client";

import { m } from "motion/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const LETTERS = "healthStation".split("");

const navLinks = [
  { label: "Overview", href: "#overview", active: true },
  { label: "How It Works", href: "#how-it-works", active: false },
  { label: "Architecture", href: "#architecture", active: false },
  { label: "Features", href: "#features", active: false },
  { label: "Demo Clinics", href: "#clinics", active: false },
];

export default function Header() {
  return (
    <header className="pt-6 md:pt-8 px-6 md:px-10 mx-auto max-w-[1400px]">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-[9.23px] group">
          <m.div
            className="w-[38px] h-[38px] rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-[18px] shadow-sm group-hover:scale-105 transition-transform"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            B
          </m.div>
          <span className="flex text-[24px] font-semibold text-[#000] tracking-tight overflow-hidden">
            {LETTERS.map((letter, i) => (
              <span key={i} className="inline-block overflow-hidden">
                <m.span
                  className="inline-block"
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.25, 1, 0.5, 1],
                    delay: 0.2 + i * 0.04,
                  }}
                >
                  {letter === " " ? "\u00A0" : letter}
                </m.span>
              </span>
            ))}
          </span>
          <span className="ml-1 text-[11px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
            Multi-Tenant
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link, i) => (
            <m.a
              key={link.label}
              href={link.href}
              className={`text-[14px] font-medium transition-colors ${
                link.active
                  ? "text-foreground underline underline-offset-[6px] decoration-[1.5px]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.3 + i * 0.05,
              }}
            >
              {link.label}
            </m.a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <m.a
            href="/login"
            className="rounded-full border border-border bg-white px-4 py-2 text-[13px] font-medium shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-muted transition-colors text-foreground"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.4,
            }}
          >
            Log In
          </m.a>

          <m.a
            href="/signup"
            className="rounded-full bg-foreground text-background px-5 py-2 text-[13px] font-medium hover:bg-foreground/90 transition-colors inline-flex items-center gap-1.5 shadow-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.45,
            }}
          >
            Sign Up
            <ArrowRight className="w-3.5 h-3.5" />
          </m.a>
        </div>
      </div>
    </header>
  );
}
