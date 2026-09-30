import type { Metadata } from "next";

import Header from "@/components/templates/main/sections/header";
import Hero from "@/components/templates/main/sections/hero";
import Showcase from "@/components/templates/main/sections/showcase";
import HowItWorks from "@/components/templates/main/sections/how-it-works";
import Intelligence from "@/components/templates/main/sections/intelligence";
import Outcomes from "@/components/templates/main/sections/outcomes";
import Testimonials from "@/components/templates/main/sections/testimonials";
import CTA from "@/components/templates/main/sections/cta";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://healthstation.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "healthStation — Multi-Tenant Telehealth & Clinic Storefront Platform",
  description:
    "Launch your branded clinic storefront in minutes with airtight PostgreSQL tenancy, custom medical catalogs, and dedicated owner admin portals.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "healthStation — Multi-Tenant Telehealth & Clinic Storefront Platform",
    description:
      "Launch your branded clinic storefront in minutes with airtight PostgreSQL tenancy, custom medical catalogs, and dedicated owner admin portals.",
    url: "/",
    siteName: "healthStation",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      <Header />
      <Hero />
      <Showcase />
      <HowItWorks />
      <Intelligence />
      <Outcomes />
      <Testimonials />
      <CTA />
    </>
  );
}