"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

const LETTERS = "healthStation".split("");

const navLinks = [
  { label: "Overview", href: "#overview", active: true },
  { label: "How It Works", href: "#how-it-works", active: false },
  { label: "Architecture", href: "#architecture", active: false },
  { label: "Features", href: "#features", active: false },
  { label: "Demo Clinics", href: "#clinics", active: false },
];

const demoClinics = [
  { label: "Cairo Heart", href: "/cairo-heart" },
  { label: "Alexandria Pediatrics", href: "/alexandria-pediatrics" },
];

function MobileSheet() {
  return (
    <Sheet modal>
      <SheetTrigger
        className="inline-flex md:hidden items-center justify-center rounded-full border border-border bg-white p-2.5 text-foreground shadow-[0_1px_0_rgba(0,0,0,0.05)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="tracking-tight">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navigation for healthStation and its demo clinic stores.
          </SheetDescription>
        </SheetHeader>

        <nav aria-label="Main" className="flex flex-col gap-1 px-4 pt-4">
          {navLinks.map((link) => (
            <SheetClose
              key={link.label}
              nativeButton={false}
              render={
                <a
                  href={link.href}
                  className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                />
              }
            >
              {link.label}
            </SheetClose>
          ))}
        </nav>

        <div className="mt-6 border-t pt-5 px-4">
          <p className="px-3 pb-2 text-[12px] font-semibold tracking-wider text-muted-foreground uppercase">
            Demo Clinic Stores
          </p>
          <div className="flex flex-col gap-1">
            {demoClinics.map((clinic) => (
              <SheetClose
                key={clinic.href}
                nativeButton={false}
                render={
                  <Link
                    href={clinic.href}
                    className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:bg-muted"
                  />
                }
              >
                {clinic.label}
                <ArrowRight className="ml-auto size-4 text-muted-foreground" />
              </SheetClose>
            ))}
          </div>
        </div>

        <SheetFooter>
          <SheetClose
            nativeButton={false}
            render={
              <Link
                href="/login"
                className="text-center rounded-full border border-border bg-white px-4 py-2.5 text-[13px] font-medium shadow-[0_1px_0_rgba(0,0,0,0.05)] transition-colors hover:bg-muted text-foreground"
              />
            }
          >
            Log In
          </SheetClose>
          <SheetClose
            nativeButton={false}
            render={
              <Link
                href="/signup"
                className="text-center rounded-full bg-foreground px-5 py-2.5 text-[13px] font-medium text-background shadow-sm transition-colors hover:bg-foreground/90"
              />
            }
          >
            Sign Up
            <ArrowRight className="size-3.5" />
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function Header() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHidden(y > 80 && y > lastY);
      lastY = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        hidden && "-translate-y-full",
      )}
    >
      <div
        className={cn(
          "transition-[background-color,border-color,box-shadow] duration-300",
          scrolled &&
            "border-b border-border/60 bg-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.05)] backdrop-blur-md",
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 pt-6 pb-6 md:px-10 md:pt-8 md:pb-7">
          <Link href="/" className="flex items-center gap-[9.23px] group min-w-0">
            <div className="anim-reveal-scale w-[38px] h-[38px] rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-[18px] shadow-sm group-hover:scale-105 transition-transform">
              B
            </div>
            <span className="flex text-[24px] font-semibold text-[#000] tracking-tight overflow-hidden">
              {LETTERS.map((letter, i) => (
                <span key={i} className="inline-block overflow-hidden">
                  <span
                    className="anim-reveal-letter inline-block"
                    style={{ animationDelay: `${0.2 + i * 0.04}s` }}
                  >
                    {letter === " " ? "\u00A0" : letter}
                  </span>
                </span>
              ))}
            </span>
            <span className="hidden sm:inline-flex ml-1 text-[11px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
              Multi-Tenant
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link.label}
                href={link.href}
                className={`anim-reveal-up-xs text-[14px] font-medium transition-colors ${
                  link.active
                    ? "text-foreground underline underline-offset-[6px] decoration-[1.5px]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ animationDelay: `${0.3 + i * 0.05}s` }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="anim-reveal-pop rounded-full border border-border bg-white px-4 py-2 text-[13px] font-medium shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-muted transition-colors text-foreground"
              style={{ animationDelay: "0.4s" }}
            >
              Log In
            </Link>

            <Link
              href="/signup"
              className="anim-reveal-pop rounded-full bg-foreground text-background px-5 py-2 text-[13px] font-medium hover:bg-foreground/90 transition-colors inline-flex items-center gap-1.5 shadow-sm"
              style={{ animationDelay: "0.45s" }}
            >
              Sign Up
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <MobileSheet />
        </div>
      </div>
    </header>
  );
}