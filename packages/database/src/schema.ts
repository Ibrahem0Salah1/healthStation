import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  boolean
} from "drizzle-orm/pg-core";
export type StorefrontHero = {
  /**
   * `string` (lowercase, the PRIMITIVE), never `String` (the boxed wrapper).
   * `String` typechecks, which is exactly why it is dangerous — it lets values
   * through that a real string would not, and it behaves as an object at
   * runtime. This shape is persisted inside jsonb, so a mistake here is a
   * data problem, not just a type problem.
   */
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
}
export type StorefrontTheme = {
  primaryColor: string;
  fontFamily: "sans" | "serif";
  showTrustBadges: boolean;
};
export type StorefrontConfig = {
  hero: StorefrontHero;
  theme: StorefrontTheme;
  announcement: string | null;
  showCategories: boolean;
};

export type ProductDetails = {
  generic: boolean;
  requiresPrescription: boolean;
  packSize: string;
  activeIngredients: string[];
};

//Enum
export const membershipRole =pgEnum('membership_role', ['owner', 'admin']);
//timestamps
const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();

const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow();


//tenants
export const tenants = pgTable('tenants', {
    id: uuid('id').defaultRandom().primaryKey(),
    name : text('name').notNull(),
    slug : text('slug').notNull().unique(),
    createdAt
})
//users
export const users = pgTable('users', {
    id : uuid('id').defaultRandom().primaryKey(),
    name : text('name').notNull(),
    email : text('email').notNull().unique(),
    passwordHash : text('password_hash').notNull(),
    createdAt
})

export const memberships = pgTable('memberships', {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId : uuid('tenant_id').notNull().references(() => tenants.id, {onDelete : 'cascade'}),
    userId : uuid('user_id').notNull().references(() => users.id, {onDelete : 'cascade'}),
    role : membershipRole('role').notNull().default('owner'),
    createdAt
},
(t) => [
    uniqueIndex("memberships_tenant_user_uidx").on(t.tenantId, t.userId),
    index("memberships_user_id_idx").on(t.userId),
]
)
//store
export const storefronts = pgTable("storefronts", {
  id: uuid("id").defaultRandom().primaryKey(),
  /**
   * `.unique()` not just `.notNull()`: one storefront per clinic,
   * guaranteed. Without it, a race between two simultaneous config
   * saves could leave a clinic with two configs and no way to tell
   * which one wins. This constraint turns that into an insert error.
   */
  tenantId: uuid("tenant_id")
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: "cascade" }),
  /** The whole editable config. Typed at compile time, flexible in the DB. */
  config: jsonb("config").$type<StorefrontConfig>().notNull(),
  createdAt,
  updatedAt,
});
//categories
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** Explicit ordering — alphabetical is not a business rule. */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
  },
  (t) => [
    /**
     * Scoped uniqueness: clinic A and clinic B can BOTH have "Pain Relief".
     * They are different tenants sharing a slug space. This is a
     * textbook multi-tenant constraint — the naive `slug UNIQUE`
     * would be a serious bug: clinic B couldn't register a category
     * clinic A already uses.
     */
    uniqueIndex("categories_tenant_slug_uidx").on(t.tenantId, t.slug),
    /**
     * Justified by: the storefront category nav —
     * "all categories for clinic X, ordered".
     */
    index("categories_tenant_id_idx").on(t.tenantId),
  ],
);
//products
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /**
     * NULLABLE on purpose: uncategorized products are real. Making this
     * NOT NULL would force a catch-all "Other" category to exist, and
     * every clinic would have to remember to use it.
     */
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    /**
     * MONEY IS AN INTEGER. NEVER float.
     * 0.1 + 0.2 === 0.30000000000000004 in IEEE-754 binary floating
     * point. Store cents, format to currency only at the edges. A
     * pharmacy that miscalculates by fractions of a penny still fails
     * an audit.
     */
    priceCents: integer("price_cents").notNull(),
    /** ISO 4217. Stored per-row because a real marketplace spans currencies. */
    currency: text("currency").notNull().default("USD"),
    /**
     * A RELATIVE path like "/products/heart-1.jpg", served from
     * apps/web/public/. Not a full URL — see 2.5/Phase 9 on object
     * storage. A tenant migrating hosts must not have to rewrite rows.
     */
    imageUrl: text("image_url"),
    details: jsonb("details").$type<ProductDetails>().notNull(),
    /** Soft delete: hide without destroying rows referenced by orders. */
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("products_tenant_slug_uidx").on(t.tenantId, t.slug),
    /**
     * THE composite index of the whole project.
     * Justified by: "active products for clinic X, ordered, optionally
     * filtered to one category" — the shop page, the single hottest
     * query in the product.
     *
     * Why (tenant_id, is_active) rather than is_active alone? Because
     * `is_active` is a boolean: ~50% true, so an index on it alone
     * matches half the table and Postgres would ignore it. Leading
     * with tenant_id makes the predicate selective, and is_active then
     * narrows further within that slice. Order matters — Postgres can
     * only use leading columns.
     */
    index("products_tenant_active_idx").on(t.tenantId, t.isActive),
    /**
     * The category page: "this clinic's products in this category".
     * Leading with tenantId rather than categoryId for the same reason as
     * above — every query in this app is tenant-scoped, so the tenant
     * predicate is always present and always the most selective leading
     * column. A bare (category_id) index would be used too, but it cannot
     * also narrow by tenant, so Postgres would still have to filter.
     */
    index("products_tenant_category_idx").on(t.tenantId, t.categoryId),
  ],
);
//session
export const sessions = pgTable(
  'sessions',
  {
    /**
     * PRIMARY KEY IS THE OPAQUE TOKEN ITSELF. The cookie carries this exact
     * value, so there is no surrogate id: the row *is* the session. It must be
     * unpredictable — the app generates 32 random bytes (256 bits) and hex
     * encodes them, giving 64 hex characters. Never a sequential integer, and
     * never anything derived from the user id.
     */
    id: text('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    /**
     * SNAKE_CASE, matching every other column in this schema.
     * (It was 'expiresAt' — camelCase. That works through Drizzle, but raw SQL
     * would need `"expiresAt"` double-quoted forever.)
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt,
  },
  (t) => [
    /**
     * Justified by: "revoke every session for this user" — the admin action
     * and the "sign out everywhere" button. Without this it is a sequential
     * scan. Also lets Postgres delete the user's session rows via the FK
     * without scanning the whole table.
     */
    index('sessions_user_id_idx').on(t.userId),
    /**
     * Justified by: the cleanup job that deletes expired sessions
     * (`DELETE FROM sessions WHERE expires_at < now()`), which runs on a
     * schedule and would otherwise scan the entire table every time.
     */
    index('sessions_expires_at_idx').on(t.expiresAt),
  ],
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type Storefront = typeof storefronts.$inferSelect;
export type NewStorefront = typeof storefronts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;