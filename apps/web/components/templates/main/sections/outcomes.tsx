import { Reveal } from "../reveal";

export default function Outcomes() {
  return (
    <section className="py-24 md:py-28 px-6 md:px-10 mx-auto max-w-[1400px] overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <Reveal
          as="p"
          animation="reveal-up-sm"
          className="text-center text-[12px] font-medium tracking-[0.18em] uppercase text-muted-foreground mb-3"
        >
          Proven Isolation &amp; Performance
        </Reveal>
      </div>

      <Reveal
        delay={0.05}
        className="mt-8 md:mt-10 max-w-5xl mx-auto text-center"
      >
        <p className="text-[36px] md:text-[56px] font-medium tracking-[-0.03em] leading-[1.12] text-foreground">
          Clinics on our platform launch in{" "}
          <span className="text-accent underline decoration-accent/30 underline-offset-8">under 2 minutes</span>
          {" "}with{" "}
          <span className="text-accent underline decoration-accent/30 underline-offset-8">100% tenant data isolation</span>,
          {" "}zero manual DevOps, and{" "}
          <span className="text-accent underline decoration-accent/30 underline-offset-8">instant catalog control</span>.
        </p>

        <Reveal
          as="p"
          animation="reveal-fade"
          delay={0.15}
          className="mt-8 text-[16px] leading-relaxed text-muted-foreground max-w-2xl mx-auto"
        >
          No cross-tenant data leaks. No database partition complexity.
          Every query and mutation is strictly verified by tRPC middleware and Drizzle ORM.
        </Reveal>
      </Reveal>
    </section>
  );
}
