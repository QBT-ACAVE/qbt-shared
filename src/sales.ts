import { sql } from "drizzle-orm";
import {
  pgSchema,
  bigint,
  text,
  timestamp,
  numeric,
  integer,
  smallint,
  boolean,
  date,
  inet,
  index,
} from "drizzle-orm/pg-core";

export const sales = pgSchema("sales");

/**
 * Per-order row for every WC order in scope (status: completed/processing/refunded,
 * parent_id=0, not a suborder). One row per order_id. Replaces the
 * Apps Script Orders_Detail tab — but with full coverage (renewals,
 * reactivates, upgrades, refunds, installments — not just direct sales).
 */
export const ordersDetail = sales.table(
  "orders_detail",
  {
    orderId: bigint("order_id", { mode: "number" }).primaryKey(),
    orderDate: date("order_date").notNull(),
    orderTime: text("order_time").notNull(), // 'HH:MM:SS' in CT
    orderHour: integer("order_hour").notNull(),
    dayOfWeek: text("day_of_week").notNull(),
    dateCreatedUtc: timestamp("date_created_utc", { withTimezone: true }).notNull(),
    netTotal: numeric("net_total", { precision: 12, scale: 2 }).notNull(),
    productType: text("product_type").notNull(), // 'TEAM' | 'Learner' | 'CERT'
    salesChannel: text("sales_channel").notNull(), // 'Authnet' | 'PayPal' | 'Stripe' | 'Other'
    status: text("status").notNull(),
    isRenewal: boolean("is_renewal").notNull().default(false),
    hasDuo: boolean("has_duo").notNull().default(false),
    authnetCategory: text("authnet_category").notNull(),
    // --- Phase 2.5 columns (added 2026-05-08) ---
    // Device + UA + IP, parsed/copied from `_customer_user_agent` and
    // `_customer_ip_address` postmeta.
    deviceClass: text("device_class"), // 'Mobile' | 'Tablet' | 'Desktop' | 'Bot' | 'Unknown'
    userAgent: text("user_agent"),
    ipAddress: inet("ip_address"),
    // Billing address from WC `_billing_*` postmeta.
    billingCountry: text("billing_country"), // ISO-2 (US, CA, GB, ...)
    billingState: text("billing_state"),
    billingCity: text("billing_city"),
    billingPostcode: text("billing_postcode"),
    // GA client_id from `_yoast_gau_uuid` postmeta. The join key into GA4 —
    // when GA4 ingestion lands in Neon, source/medium/campaign get pulled
    // via JOIN on this column. MonsterInsights' own attribution data is
    // sparse (~6% coverage) and this is what populates everywhere MI does
    // plus more, so we skip the MI parsing entirely.
    gaClientId: text("ga_client_id"),
    // Most-significant coupon used on the order (highest discount_amount
    // when multiple are applied). Pulled from
    // wp_woocommerce_order_items + wp_woocommerce_order_itemmeta.
    couponCode: text("coupon_code"),
    // Authorize.net CIM card metadata. Brand from
    // `_wc_authorize_net_cim_credit_card_card_type`. Expiry parsed from
    // `_wc_authorize_net_cim_credit_card_card_expiry_date` which stores
    // 'YY-MM' (e.g. '29-02' = Feb 2029).
    cardBrand: text("card_brand"),
    cardExpMonth: smallint("card_exp_month"),
    cardExpYear: smallint("card_exp_year"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byDate: index("orders_detail_by_date").on(t.orderDate),
    byCategory: index("orders_detail_by_category").on(t.authnetCategory),
    byDateCategory: index("orders_detail_by_date_category").on(t.orderDate, t.authnetCategory),
    // Phase 2.5 — partial indexes (skip the pre-backfill NULL rows).
    byBillingState: index("idx_orders_state")
      .on(t.billingState)
      .where(sql`${t.billingState} IS NOT NULL`),
    byBillingCountry: index("idx_orders_country")
      .on(t.billingCountry)
      .where(sql`${t.billingCountry} IS NOT NULL`),
    byGaClientId: index("idx_orders_ga_client")
      .on(t.gaClientId)
      .where(sql`${t.gaClientId} IS NOT NULL`),
    byCoupon: index("idx_orders_coupon")
      .on(t.couponCode)
      .where(sql`${t.couponCode} IS NOT NULL`),
    byCardExpiry: index("idx_orders_card_expiry")
      .on(t.cardExpYear, t.cardExpMonth)
      .where(sql`${t.cardExpYear} IS NOT NULL`),
  }),
);

/**
 * Daily aggregate — one row per CT calendar date. Built from ordersDetail
 * via SQL GROUP BY in the rebuild script (or as a Postgres view).
 *
 * Same 22 metric columns as the Apps Script Daily tab.
 */
export const ordersDailyAggregate = sales.table("orders_daily_aggregate", {
  orderDate: date("order_date").primaryKey(),
  directSales: integer("direct_sales").notNull().default(0),
  learner: integer("learner").notNull().default(0),
  cert: integer("cert").notNull().default(0),
  team: integer("team").notNull().default(0),
  duo: integer("duo").notNull().default(0),
  discounted: integer("discounted").notNull().default(0),
  directRevenue: numeric("direct_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  reactivates: integer("reactivates").notNull().default(0),
  reactivateRevenue: numeric("reactivate_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  upgrades: integer("upgrades").notNull().default(0),
  upgradeCert: integer("upgrade_cert").notNull().default(0),
  upgradePlanSwap: integer("upgrade_plan_swap").notNull().default(0),
  upgradeCertToTeam: integer("upgrade_cert_to_team").notNull().default(0),
  upgradeLearnerToTeam: integer("upgrade_learner_to_team").notNull().default(0),
  upgradeRevenue: numeric("upgrade_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  renewals: integer("renewals").notNull().default(0),
  renewalRevenue: numeric("renewal_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  installments: integer("installments").notNull().default(0),
  installmentRevenue: numeric("installment_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  refunds: integer("refunds").notNull().default(0),
  refundRevenue: numeric("refund_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  totalGrossRevenue: numeric("total_gross_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  rebuiltAt: timestamp("rebuilt_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Product catalog — canonical mapping from WC product_id to its
 * authnet_category. Replaces price-tier guessing in classify.ts.
 *
 * Seeded by `scripts/seed-product-catalog.ts`. New products encountered in
 * the wild but absent from this table fall through to legacy price-tier
 * rules and get logged as warnings.
 */
export const productCatalog = sales.table("product_catalog", {
  productId: bigint("product_id", { mode: "number" }).primaryKey(),
  sku: text("sku"),
  productName: text("product_name"),
  productFamily: text("product_family").notNull(), // 'learner' | 'cert' | 'team' | 'duo' | 'subscription' | 'workshop' | 'payplan_cert' | 'payplan_installment' | 'upgrade_cert' | 'upgrade_cert_to_team' | 'upgrade_learner_to_team' | 'upgrade_duo' | 'promo_sub' | 'excluded'
  categoryWhenNew: text("category_when_new").notNull(), // authnet_category to assign for non-renewal purchases
  isDirectSale: boolean("is_direct_sale").notNull().default(false),
  notes: text("notes"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrderDetailRow = typeof ordersDetail.$inferInsert;
export type OrderDailyRow = typeof ordersDailyAggregate.$inferInsert;
export type ProductCatalogRow = typeof productCatalog.$inferInsert;
