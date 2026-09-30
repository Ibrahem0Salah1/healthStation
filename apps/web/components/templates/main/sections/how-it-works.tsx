import { UserPlus, Palette, Rocket } from "lucide-react";

import { Reveal } from "../reveal";

const steps = [
  {
    num: "01",
    icon: UserPlus,
    title: "Sign up & provision your clinic",
    desc: "Register your clinic name, custom URL slug (e.g. /cairo-heart), and owner credentials in seconds with an atomic, zero-collision transaction.",
  },
  {
    num: "02",
    icon: Palette,
    title: "Configure storefront & catalog",
    desc: "Log in to your dedicated /{slug}/admin portal to customize brand themes, hero banners, medical categories, and prescription product details.",
  },
  {
    num: "03",
    icon: Rocket,
    title: "Launch & serve patients with total isolation",
    desc: "Your clinic goes live instantly at /{slug}. Patients browse seamless storefronts while strict tRPC RBAC guards your administrative endpoints.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-28 px-6 md:px-10 mx-auto max-w-[1400px]">
      <div className="max-w-5xl mx-auto">
        <Reveal
          as="p"
          animation="reveal-up-sm"
          className="text-center text-[12px] font-medium tracking-[0.18em] uppercase text-muted-foreground mb-3"
        >
          Three Simple Steps
        </Reveal>
        <Reveal
          as="h2"
          delay={0.05}
          className="text-center text-[36px] md:text-[52px] font-medium tracking-[-0.03em] leading-[1.08] text-foreground"
        >
          From tenant sign-up
          <br />
          <span className="text-muted-foreground/40">to live clinic storefront.</span>
        </Reveal>
      </div>

      <div className="relative mt-16 md:mt-20 max-w-4xl mx-auto">
        <div className="hidden md:block absolute left-8 top-0 bottom-0 w-px bg-border/60" />

        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <Reveal
              key={step.num}
              delay={i * 0.1}
              className="relative flex items-start gap-6 md:gap-8 pb-14 md:pb-16 last:pb-0"
            >
              <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-background border border-border/60 shadow-xs">
                <Icon className="w-5 h-5 text-accent" />
              </div>

              <div className="flex-1 min-w-0 pt-1.5">
                <span
                  className="text-[48px] md:text-[64px] font-bold leading-none select-none pointer-events-none absolute right-0 top-0 opacity-[0.025]"
                  aria-hidden
                >
                  {step.num}
                </span>
                <span className="text-[12px] font-semibold tracking-widest uppercase text-accent/70">
                  Step {step.num}
                </span>
                <h3 className="mt-1.5 text-[20px] md:text-[22px] font-medium tracking-[-0.02em] leading-[1.2] text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-[1.7] text-muted-foreground max-w-[480px]">
                  {step.desc}
                </p>
              </div>
            </Reveal>
          );
        })}

        <Reveal
          as="p"
          animation="reveal-fade"
          delay={0.3}
          className="mt-6 text-center text-[13px] text-muted-foreground/60 italic"
        >
          One shared monorepo codebase. Unlimited independent clinic storefronts.
        </Reveal>
      </div>
    </section>
  );
}
