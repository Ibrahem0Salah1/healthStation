import Link from "next/link";
import { ArrowLeft, Check, Store } from "lucide-react";

/**
 * The shared chrome for /login and /signup.
 *
 * WHY A SHARED SHELL INSTEAD OF TWO PAGES WITH SIMILAR JSX: the landing page's
 * design language lives in about six Tailwind utilities repeated across eight
 * sections. Copying them into two auth pages means three places to update
 * when the design changes. Here, the auth pages declare only what is actually
 * different between them (the form and the pitch) and inherit everything else.
 *
 * SERVER COMPONENT (no "use client"): it renders no state and no handlers.
 * Everything interactive is the form passed in as `children`, which is the
 * one piece that needs to ship JavaScript. So the frame — the biggest part of
 * the markup — costs zero bytes of client JS.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  pitch,
  children,
  footer,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  pitch: string[];
  /** The client form. This is the only client-rendered part. */
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="pt-6 md:pt-8 px-6 md:px-10 mx-auto w-full max-w-[1400px]">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-[9.23px] group"
            aria-label="Back to home"
          >
            <div className="w-[38px] h-[38px] rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-[18px] shadow-sm group-hover:scale-105 transition-transform">
              B
            </div>
            <span className="text-[24px] font-semibold text-foreground tracking-tight">
              Bask
            </span>
            <span className="ml-1 text-[11px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
              Multi-Tenant
            </span>
          </Link>

          <Link
            href="/"
            className="rounded-full border border-border bg-white px-4 py-2 text-[13px] font-medium shadow-[0_1px_0_rgba(0,0,0,0.05)] hover:bg-muted transition-colors text-foreground inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center px-6 md:px-10 py-12 md:py-16">
        <div className="mx-auto w-full max-w-[1400px]">
          {/*
            `mesh-showcase` is the landing page's own background class from
            globals.css. Reusing it rather than inventing a new treatment is
            the entire point — the auth pages must read as the same product,
            not a separate app that happens to share a logo.
          */}
          <div className="mesh-showcase rounded-[28px] border border-black/5 p-5 md:p-7">
            <div className="grid lg:grid-cols-2 gap-5">
              {/* ── LEFT: the pitch ─────────────────────────────────────── */}
              <div className="rounded-[22px] p-6 md:p-9 flex flex-col justify-between bg-white border border-border/60 shadow-sm min-h-[420px]">
                <div>
                  <div className="inline-flex items-center gap-[10px] rounded-[8px] px-[12px] py-[5px] eyebrow-bg border border-black/5">
                    <span className="inline-flex items-center justify-center w-[24px] h-[22px] rounded-[4px] bg-white shadow-xs">
                      <Store className="w-3.5 h-3.5 text-accent" />
                    </span>
                    <span className="text-[13px] font-medium text-foreground">
                      {eyebrow}
                    </span>
                  </div>

                  <h1 className="mt-6 text-[34px] md:text-[46px] font-medium leading-[1.08] tracking-[-0.035em] text-foreground">
                    {title}
                  </h1>

                  <p className="mt-4 text-[15px] leading-[1.6] text-muted-foreground max-w-[420px]">
                    {subtitle}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-border/80 flex flex-col gap-2.5">
                  {pitch.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2.5 text-[13px] text-foreground/80"
                    >
                      <span className="w-4 h-4 rounded flex items-center justify-center bg-accent/15 text-accent shrink-0">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── RIGHT: the form ─────────────────────────────────────── */}
              <div className="rounded-[22px] p-6 md:p-9 bg-white border border-border/60 shadow-sm">
                {children}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 md:px-10 mx-auto w-full max-w-[1400px] pb-8">
        <div className="text-center text-[12px] text-muted-foreground">
          {footer}
        </div>
      </footer>
    </div>
  );
}
