"use client";

import { LazyMotion, domAnimation } from "motion/react";
import Header from "@/components/templates/main/sections/header";
import Hero from "@/components/templates/main/sections/hero";
import Showcase from "@/components/templates/main/sections/showcase";
import HowItWorks from "@/components/templates/main/sections/how-it-works";
import Intelligence from "@/components/templates/main/sections/intelligence";
import Outcomes from "@/components/templates/main/sections/outcomes";
import Testimonials from "@/components/templates/main/sections/testimonials";
import CTA from "@/components/templates/main/sections/cta";

export default function HomePage() {
  return (
    <LazyMotion features={domAnimation}>
      <Header />
      <Hero />
      <Showcase />
      <HowItWorks />
      <Intelligence />
      <Outcomes />
      <Testimonials />
      <CTA />
    </LazyMotion>
  );
}
