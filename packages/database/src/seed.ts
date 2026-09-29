import path from "node:path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";

import {
  categories,
  memberships,
  products,
  storefronts,
  tenants,
  users,
} from "./schema";

/**
 * .env lives at the MONOREPO ROOT — the same contract drizzle.config.ts uses.
 */
dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});

/**
 * MUST be a dynamic import, and it must come AFTER dotenv.config().
 *
 * db.ts reads process.env.DATABASE_URL at its module top level. ESM hoists
 * static imports, so `import { db } from "./db"` at the top of this file would
 * evaluate db.ts's body BEFORE the dotenv.config() line ever ran — the URL
 * would be undefined and db.ts would throw. Dynamic import defers evaluation
 * to exactly this point, so env is populated first.
 */
const { db } = await import("./db");

const DEMO_PASSWORD = "Password123!";

/**
 * Only four placeholder images, cycled across products. Real uploads are out
 * of scope (INSTRUCTIONS §5) — this exists so the shop grid has a real
 * `imageUrl` to render instead of broken image icons.
 */
const IMAGES = [
  "/products/pill.svg",
  "/products/box.svg",
  "/products/bottle.svg",
  "/products/kit.svg",
];

type ProductSeed = {
  name: string;
  slug: string;
  summary: string;
  description: string;
  priceCents: number;
  details: {
    generic: boolean;
    requiresPrescription: boolean;
    packSize: string;
    activeIngredients: string[];
  };
};

type TenantSeed = {
  tenantName: string;
  tenantSlug: string;
  ownerName: string;
  ownerEmail: string;
  storefront: {
    headline: string;
    subheadline: string;
    ctaLabel: string;
    ctaHref: string;
    primaryColor: string;
    announcement: string | null;
    showTrustBadges: boolean;
  };
  categories: {
    name: string;
    slug: string;
    products: ProductSeed[];
  }[];
};

async function seedTenant(data: TenantSeed) {
  const [existingTenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, data.tenantSlug))
    .limit(1);

  if (existingTenant) {
    console.log(`  skip ${data.tenantSlug} (already exists)`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  /**
   * ONE TRANSACTION for the entire tenant.
   *
   * The same atomicity the signup route uses: a tenant with a storefront but
   * no owner, or products pointing at a tenant that was rolled back, would be
   * permanently broken demo data. All of it lands, or none of it does.
   */
  await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: data.tenantName, slug: data.tenantSlug })
      .returning({ id: tenants.id });

    if (!tenant) throw new Error(`Failed to create tenant ${data.tenantSlug}`);

    const [user] = await tx
      .insert(users)
      .values({
        name: data.ownerName,
        email: data.ownerEmail,
        passwordHash,
      })
      .returning({ id: users.id });

    if (!user) throw new Error(`Failed to create owner ${data.ownerEmail}`);

    await tx.insert(memberships).values({
      tenantId: tenant.id,
      userId: user.id,
      role: "owner",
    });

    await tx.insert(storefronts).values({
      tenantId: tenant.id,
      config: {
        hero: {
          headline: data.storefront.headline,
          subheadline: data.storefront.subheadline,
          ctaLabel: data.storefront.ctaLabel,
          ctaHref: data.storefront.ctaHref,
        },
        theme: {
          primaryColor: data.storefront.primaryColor,
          fontFamily: "sans",
          showTrustBadges: data.storefront.showTrustBadges,
        },
        announcement: data.storefront.announcement,
        showCategories: true,
      },
    });

    let imageCursor = 0;

    for (const [catIndex, categoryData] of data.categories.entries()) {
      const [category] = await tx
        .insert(categories)
        .values({
          tenantId: tenant.id,
          name: categoryData.name,
          slug: categoryData.slug,
          // Explicit ordering — this is what `sortOrder` is for, so the nav
          // order is a business decision rather than alphabetical accident.
          sortOrder: catIndex,
        })
        .returning({ id: categories.id });

      if (!category) throw new Error(`Failed to create category ${categoryData.slug}`);

      await tx.insert(products).values(
        categoryData.products.map((product, productIndex) => ({
          tenantId: tenant.id,
          categoryId: category.id,
          name: product.name,
          slug: product.slug,
          summary: product.summary,
          description: product.description,
          // MONEY IS AN INTEGER COUNT OF CENTS. Never a float — see schema.ts.
          priceCents: product.priceCents,
          currency: "USD",
          // A RELATIVE path served from apps/web/public/. Not a full URL:
          // moving hosts must not require rewriting every product row.
          imageUrl: IMAGES[imageCursor++ % IMAGES.length]!,
          details: product.details,
          sortOrder: productIndex,
          isActive: true,
        })),
      );
    }
  });

  const total = data.categories.reduce((n, c) => n + c.products.length, 0);
  console.log(`  seeded ${data.tenantSlug} — ${data.categories.length} categories, ${total} products`);
}

/**
 * DESTRUCTIVE. Wipes every table and rebuilds from scratch.
 *
 * The seed is otherwise idempotent-by-skip: if a tenant already exists it
 * leaves it alone. That is right for production and painful for development —
 * you cannot change the seed data and see the change without manually opening
 * a SQL client. This flag is the escape hatch.
 *
 * Guarded on NODE_ENV so it can never run against a real database.
 *
 * TRUNCATE ... CASCADE resets identity sequences and empties every table that
 * references the truncated ones, which is what we want: a clean slate.
 */
async function resetDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to reset: NODE_ENV is 'production'. This script has no such guard on a managed database and would destroy live data.",
    );
  }

  console.log("Resetting database (TRUNCATE CASCADE)...");
  await db.execute(sql`TRUNCATE TABLE
    sessions, memberships, products, categories, storefronts, tenants, users
    RESTART IDENTITY CASCADE`);
  console.log("  cleared.");
}

const CAIRO: TenantSeed = {
  tenantName: "Cairo Heart",
  tenantSlug: "cairo-heart",
  ownerName: "Cairo Heart Owner",
  ownerEmail: "cairo@demo.test",
  storefront: {
    headline: "Your Heart Health, Simplified",
    subheadline: "Trusted telehealth cardiovascular care, delivered by licensed specialists.",
    ctaLabel: "Explore Treatments",
    ctaHref: "/shop",
    primaryColor: "#B91C1C",
    announcement: "Free first consultation for eligible patients.",
    showTrustBadges: true,
  },
  categories: [
    {
      name: "Heart Health",
      slug: "heart-health",
      products: [
        {
          name: "Cardio Support Kit",
          slug: "cardio-support-kit",
          summary: "Daily cardiovascular support with clinically studied dosages.",
          description:
            "A comprehensive daily formula supporting healthy blood pressure and cholesterol levels. Dispensed by licensed cardiologists with dosage guidance included.",
          priceCents: 4900,
          details: { generic: true, requiresPrescription: false, packSize: "30 tablets", activeIngredients: ["Omega-3", "Coenzyme Q10", "Vitamin D3"] },
        },
        {
          name: "Blood Pressure Monitor",
          slug: "blood-pressure-monitor",
          summary: "Clinically validated at-home monitor with telehealth review.",
          description:
            "An upper-arm automatic blood pressure monitor. Upload a reading to your clinic dashboard and a specialist reviews it within 24 hours.",
          priceCents: 12900,
          details: { generic: false, requiresPrescription: false, packSize: "1 device", activeIngredients: [] },
        },
        {
          name: "Statin Support Complex",
          slug: "statin-support-complex",
          summary: "Muscle and liver support alongside prescribed statin therapy.",
          description:
            "Formulated to support the muscles and liver during long-term statin use. Prescription required; our clinicians review your current medication before dispensing.",
          priceCents: 6400,
          details: { generic: true, requiresPrescription: true, packSize: "60 capsules", activeIngredients: ["Coenzyme Q10", "Selenium", "Vitamin B12"] },
        },
      ],
    },
    {
      name: "Cholesterol",
      slug: "cholesterol",
      products: [
        {
          name: "Plant Sterol Blend",
          slug: "plant-sterol-blend",
          summary: "Reduces LDL absorption with 2g of plant sterols daily.",
          description:
            "A once-daily blend clinically shown to reduce LDL cholesterol absorption. Works alongside dietary change and is not a substitute for prescribed therapy.",
          priceCents: 3900,
          details: { generic: true, requiresPrescription: false, packSize: "60 capsules", activeIngredients: ["Plant Sterols", "Beta-Glucan"] },
        },
        {
          name: "Omega-3 Triple Strength",
          slug: "omega-3-triple-strength",
          summary: "High-absorption EPA and DHA from molecular distillation.",
          description:
            "Molecularly distilled and third-party tested for purity. Supports healthy triglyceride levels and cardiovascular function.",
          priceCents: 3200,
          details: { generic: true, requiresPrescription: false, packSize: "90 softgels", activeIngredients: ["EPA", "DHA", "Algal Oil"] },
        },
        {
          name: "Lipid Panel Review",
          slug: "lipid-panel-review",
          summary: "At-home lipid test with a cardiologist interpreting your results.",
          description:
            "A finger-prick sample analysed by an accredited lab, followed by a written interpretation and treatment plan from a cardiologist.",
          priceCents: 9900,
          details: { generic: false, requiresPrescription: false, packSize: "1 test", activeIngredients: [] },
        },
      ],
    },
    {
      name: "Blood Pressure",
      slug: "blood-pressure",
      products: [
        {
          name: "Natural BP Support",
          slug: "natural-bp-support",
          summary: "Beetroot and hibiscus formula for healthy blood pressure.",
          description:
            "A daily formula built around clinically studied doses of beetroot extract and hibiscus, intended to support already-healthy blood pressure alongside lifestyle change.",
          priceCents: 3600,
          details: { generic: true, requiresPrescription: false, packSize: "60 capsules", activeIngredients: ["Beetroot Extract", "Hibiscus", "Potassium"] },
        },
        {
          name: "Low-Sodium Seasoning Set",
          slug: "low-sodium-seasoning-set",
          summary: "Five full-flavour seasonings with under 1g sodium per serving.",
          description:
            "Clinical guidance for blood pressure management almost always starts with sodium reduction. This set makes that change survivable rather than punishing.",
          priceCents: 1800,
          details: { generic: true, requiresPrescription: false, packSize: "5 jars", activeIngredients: [] },
        },
        {
          name: "Arterial Stiffness Screening",
          slug: "arterial-stiffness-screening",
          summary: "Non-invasive pulse-wave velocity screening with specialist review.",
          description:
            "A clinic-based screening that measures arterial stiffness, followed by a video consultation explaining your results and what they mean.",
          priceCents: 14900,
          details: { generic: false, requiresPrescription: false, packSize: "1 screening", activeIngredients: [] },
        },
      ],
    },
    {
      name: "Recovery & Heart Health",
      slug: "recovery-heart-health",
      products: [
        {
          name: "Cardiac Rehabilitation Program",
          slug: "cardiac-rehabilitation-program",
          summary: "Twelve-week supervised programme following cardiac events.",
          description:
            "A structured programme combining supervised exercise, dietary counselling, and medication review, delivered remotely with weekly check-ins from a cardiac physiotherapist.",
          priceCents: 45000,
          details: { generic: false, requiresPrescription: true, packSize: "12 weeks", activeIngredients: [] },
        },
        {
          name: "Magnesium Glycinate",
          slug: "magnesium-glycinate",
          summary: "Gentle, highly absorbable magnesium for sleep and recovery.",
          description:
            "Glycinate-bound magnesium is well tolerated and highly bioavailable, making it a common choice where citrate causes digestive discomfort.",
          priceCents: 2400,
          details: { generic: true, requiresPrescription: false, packSize: "120 capsules", activeIngredients: ["Magnesium Bisglycinate"] },
        },
        {
          name: "Sleep & Stress Complex",
          slug: "sleep-stress-complex",
          summary: "L-theanine and magnesium for recovery-focused rest.",
          description:
            "Poor sleep is a direct driver of blood pressure and cardiovascular risk. This formula supports rest without sedation, so it does not interfere with daytime focus.",
          priceCents: 2800,
          details: { generic: true, requiresPrescription: false, packSize: "60 capsules", activeIngredients: ["L-Theanine", "Magnesium", "Ashwagandha"] },
        },
      ],
    },
  ],
};

const ALEXANDRIA: TenantSeed = {
  tenantName: "Alexandria Pediatrics",
  tenantSlug: "alexandria-pediatrics",
  ownerName: "Alexandria Pediatrics Owner",
  ownerEmail: "alex@demo.test",
  storefront: {
    headline: "Care Designed for Growing Families",
    subheadline: "Accessible pediatric telehealth for every stage from newborn to teen.",
    ctaLabel: "Browse Care",
    ctaHref: "/shop",
    primaryColor: "#2563EB",
    announcement: "Same-day virtual appointments available.",
    showTrustBadges: true,
  },
  categories: [
    {
      name: "Fever & Pain",
      slug: "fever-pain",
      products: [
        {
          name: "Children's Paracetamol",
          slug: "childrens-paracetamol",
          summary: "Age-dosed liquid paracetamol with a syringe dispenser.",
          description:
            "Pre-measured liquid paracetamol for infants and children, supplied with an oral syringe so dosing by weight is accurate rather than guessed.",
          priceCents: 1200,
          details: { generic: true, requiresPrescription: false, packSize: "100ml", activeIngredients: ["Paracetamol 160mg/5ml"] },
        },
        {
          name: "Pediatric Ibuprofen",
          slug: "pediatric-ibuprofen",
          summary: "Fast-acting ibuprofen suspension for children over 6 months.",
          description:
            "Ibuprofen suspension dosed for pediatric use. Suitable for fever and pain where paracetamol is not appropriate. Not for infants under six months.",
          priceCents: 1350,
          details: { generic: true, requiresPrescription: false, packSize: "100ml", activeIngredients: ["Ibuprofen 100mg/5ml"] },
        },
        {
          name: "Digital Thermometer",
          slug: "digital-thermometer",
          summary: "Ten-second forehead and oral reading for restless children.",
          description:
            "Dual-mode thermometer reading from the forehead or under the tongue, with a fever alarm and a backlit display for night checks.",
          priceCents: 3400,
          details: { generic: false, requiresPrescription: false, packSize: "1 device", activeIngredients: [] },
        },
      ],
    },
    {
      name: "Nutrition",
      slug: "nutrition",
      products: [
        {
          name: "Infant Formula Stage 1",
          slug: "infant-formula-stage-1",
          summary: "Stage 1 newborn formula, ready to prepare.",
          description:
            "Gentle stage 1 formula suitable from birth. Every batch is independently tested and screened, with preparation instructions included.",
          priceCents: 5400,
          details: { generic: true, requiresPrescription: false, packSize: "800g", activeIngredients: ["Whey Protein", "DHA", "Prebiotics"] },
        },
        {
          name: "Child Multivitamin",
          slug: "child-multivitamin",
          summary: "Age-appropriate vitamin and mineral supplement, berry flavoured.",
          description:
            "A supplement formulated for children who are not meeting dietary requirements, in a taste children actually accept.",
          priceCents: 2600,
          details: { generic: true, requiresPrescription: false, packSize: "60 gummies", activeIngredients: ["Vitamin D3", "Vitamin C", "Zinc", "Iron"] },
        },
        {
          name: "Pediatrician Consult",
          slug: "pediatrician-consult",
          summary: "30-minute video consultation with a licensed pediatrician.",
          description:
            "A video consultation covering growth, development, feeding, and any concern you have about your child. Available seven days a week.",
          priceCents: 7500,
          details: { generic: false, requiresPrescription: false, packSize: "30 minutes", activeIngredients: [] },
        },
      ],
    },
    {
      name: "Skin & Allergy",
      slug: "skin-allergy",
      products: [
        {
          name: "Diaper Rash Ointment",
          slug: "diaper-rash-ointment",
          summary: "Zinc oxide barrier ointment for infant diaper rash.",
          description:
            "A thick zinc oxide barrier that protects skin from moisture. Fragrance-free and safe from birth, which matters more than it sounds.",
          priceCents: 1650,
          details: { generic: true, requiresPrescription: false, packSize: "110g", activeIngredients: ["Zinc Oxide 20%"] },
        },
        {
          name: "Eczema Relief Cream",
          slug: "eczema-relief-cream",
          summary: "Fragrance-free emollient for dry and eczema-prone skin.",
          description:
            "A rich emollient for dry, itchy, or eczema-prone skin. Deliberately free of fragrance and common irritants, because that is usually the cause.",
          priceCents: 3100,
          details: { generic: true, requiresPrescription: false, packSize: "200ml", activeIngredients: ["Ceramide", "Shea Butter", "Squalane"] },
        },
        {
          name: "Allergy Test Panel",
          slug: "allergy-test-panel",
          summary: "At-home panel covering the common childhood allergens.",
          description:
            "A finger-prick sample screened for dust mites, pollen, pet dander, and common foods, followed by a written explanation from a pediatrician.",
          priceCents: 8900,
          details: { generic: false, requiresPrescription: false, packSize: "1 panel", activeIngredients: [] },
        },
      ],
    },
    {
      name: "Sleep & Development",
      slug: "sleep-development",
      products: [
        {
          name: "White Noise Machine",
          slug: "white-noise-machine",
          summary: "Twelve looping sounds with a night light and sleep timer.",
          description:
            "Twelve looping ambient sounds, a dimmable night light, and a timer that fades out so the unit does not run all night.",
          priceCents: 5900,
          details: { generic: false, requiresPrescription: false, packSize: "1 device", activeIngredients: [] },
        },
        {
          name: "Children's Melatonin",
          slug: "childrens-melatonin",
          summary: "Low-dose melatonin formulated for children over 3.",
          description:
            "A low-dose melatonin gummy for children over three who struggle to fall asleep. Intended for short-term use alongside consistent bedtime routines.",
          priceCents: 2900,
          details: { generic: true, requiresPrescription: true, packSize: "30 gummies", activeIngredients: ["Melatonin 1mg"] },
        },
        {
          name: "Growth & Development Review",
          slug: "growth-development-review",
          summary: "Pediatrician review of growth charts and developmental milestones.",
          description:
            "A structured review of your child's growth chart, milestones, and any concerns, with a written plan and follow-up interval.",
          priceCents: 6500,
          details: { generic: false, requiresPrescription: false, packSize: "1 review", activeIngredients: [] },
        },
      ],
    },
  ],
};

async function main() {
  const reset = process.argv.includes("--reset");

  if (reset) {
    await resetDatabase();
  }

  console.log("Seeding demo data...\n");
  await seedTenant(CAIRO);
  await seedTenant(ALEXANDRIA);

  console.log("\nDone.");
  console.log(`  ${CAIRO.tenantSlug}  →  ${CAIRO.ownerEmail}`);
  console.log(`  ${ALEXANDRIA.tenantSlug}  →  ${ALEXANDRIA.ownerEmail}`);
  console.log(`  password (both):  ${DEMO_PASSWORD}`);
}

main()
  .then(() => {
    // Explicit exit: postgres.js keeps a connection pool alive, so without
    // this the process would hang after the work is finished.
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
