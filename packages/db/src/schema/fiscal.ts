import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { FiscalDocumentModel } from "@paperclipai/shared";
import { agents } from "./agents.js";
import { assets } from "./assets.js";
import { cases } from "./cases.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

/**
 * Fiscal module tables — Paperclip ERP.
 *
 * Company-scoped. Fiscal events are append-only by contract: no route mutates
 * or deletes `fiscalEvents` rows (legal retention, auditability).
 */

export const fiscalProviderBindings = pgTable(
  "fiscal_provider_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull(),
    documentModels: jsonb("document_models")
      .$type<FiscalDocumentModel[]>()
      .notNull()
      .default([]),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderUq: uniqueIndex("fiscal_provider_bindings_company_provider_uq").on(
      table.companyId,
      table.providerKey,
    ),
    companyIdx: index("fiscal_provider_bindings_company_idx").on(table.companyId),
  }),
);

export const fiscalDocuments = pgTable(
  "fiscal_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "set null" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    operationDirection: text("operation_direction").notNull(),
    status: text("status").notNull().default("draft"),
    accessKey: text("access_key").notNull(),
    number: integer("number").notNull(),
    series: integer("series").notNull().default(1),
    environment: text("environment").notNull().default("homologation"),
    emitter: jsonb("emitter").$type<Record<string, unknown>>().notNull(),
    receiver: jsonb("receiver").$type<Record<string, unknown> | null>(),
    emitterTaxId: text("emitter_tax_id").notNull(),
    receiverTaxId: text("receiver_tax_id"),
    totalsCents: integer("totals_cents").notNull().default(0),
    splitPayment: jsonb("split_payment").$type<Record<string, unknown>>(),
    providerExtras: jsonb("provider_extras").$type<Record<string, unknown>>(),
    providerKey: text("provider_key"),
    providerDocumentId: text("provider_document_id"),
    protocol: text("protocol"),
    errorMessage: text("error_message"),
    xmlAssetId: uuid("xml_asset_id").references(() => assets.id, { onDelete: "set null" }),
    danfeAssetId: uuid("danfe_asset_id").references(() => assets.id, { onDelete: "set null" }),
    providerRaw: jsonb("provider_raw").$type<Record<string, unknown>>(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAccessKeyUq: uniqueIndex("fiscal_documents_company_access_key_uq").on(
      table.companyId,
      table.accessKey,
    ),
    companyStatusIdx: index("fiscal_documents_company_status_idx").on(table.companyId, table.status),
    companyModelCreatedIdx: index("fiscal_documents_company_model_created_idx").on(
      table.companyId,
      table.model,
      table.createdAt,
    ),
    companyCaseIdx: index("fiscal_documents_company_case_idx").on(table.companyId, table.caseId),
    companyIssueIdx: index("fiscal_documents_company_issue_idx").on(table.companyId, table.issueId),
    statusCheck: check(
      "fiscal_documents_status_check",
      sql`${table.status} in (
        'draft', 'validated', 'transmitted', 'authorized', 'rejected', 'denied',
        'cancelled', 'invalidated', 'error'
      )`,
    ),
    modelCheck: check(
      "fiscal_documents_model_check",
      sql`${table.model} in ('nfe', 'nfce', 'nfse', 'cte', 'mdfe', 'dfe')`,
    ),
    directionCheck: check(
      "fiscal_documents_direction_check",
      sql`${table.operationDirection} in ('inbound', 'outbound')`,
    ),
  }),
);

export const fiscalDocumentItems = pgTable(
  "fiscal_document_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fiscalDocumentId: uuid("fiscal_document_id").notNull().references(() => fiscalDocuments.id, {
      onDelete: "cascade",
    }),
    position: integer("position").notNull().default(0),
    ncm: text("ncm"),
    cest: text("cest"),
    cfop: text("cfop"),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    unit: text("unit").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyDocIdx: index("fiscal_document_items_company_doc_idx").on(
      table.companyId,
      table.fiscalDocumentId,
    ),
    docPositionUq: uniqueIndex("fiscal_document_items_doc_position_uq").on(
      table.fiscalDocumentId,
      table.position,
    ),
  }),
);

export const fiscalDocumentTaxes = pgTable(
  "fiscal_document_taxes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fiscalDocumentId: uuid("fiscal_document_id").notNull().references(() => fiscalDocuments.id, {
      onDelete: "cascade",
    }),
    fiscalDocumentItemId: uuid("fiscal_document_item_id").references(() => fiscalDocumentItems.id, {
      onDelete: "cascade",
    }),
    taxType: text("tax_type").notNull(),
    baseCents: integer("base_cents").notNull().default(0),
    rateBps: integer("rate_bps").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    creditable: boolean("creditable").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyDocIdx: index("fiscal_document_taxes_company_doc_idx").on(
      table.companyId,
      table.fiscalDocumentId,
    ),
    docTaxTypeIdx: index("fiscal_document_taxes_doc_tax_type_idx").on(
      table.fiscalDocumentId,
      table.taxType,
    ),
    taxTypeCheck: check(
      "fiscal_document_taxes_tax_type_check",
      sql`${table.taxType} in ('ibs', 'cbs', 'is', 'icms', 'ipi', 'pis', 'cofins')`,
    ),
  }),
);

export const fiscalEvents = pgTable(
  "fiscal_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fiscalDocumentId: uuid("fiscal_document_id").notNull().references(() => fiscalDocuments.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(),
    actorType: text("actor_type").notNull(),
    actorUserId: text("actor_user_id"),
    actorAgentId: uuid("actor_agent_id").references(() => agents.id, { onDelete: "set null" }),
    runId: uuid("run_id"),
    providerEventKind: text("provider_event_kind"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyDocCreatedIdx: index("fiscal_events_company_doc_created_idx").on(
      table.companyId,
      table.fiscalDocumentId,
      table.createdAt,
    ),
    docIdx: index("fiscal_events_doc_idx").on(table.fiscalDocumentId),
    kindIdx: index("fiscal_events_kind_idx").on(table.kind),
    kindCheck: check(
      "fiscal_events_kind_check",
      sql`${table.kind} in (
        'created', 'validated', 'transmitted', 'authorized', 'rejected', 'denied',
        'cancelled', 'invalidated', 'cc-e', 'manifestation', 'provider_callback', 'error'
      )`,
    ),
    actorTypeCheck: check("fiscal_events_actor_type_check", sql`${table.actorType} in ('user', 'agent', 'system')`),
  }),
);

export const fiscalDocumentLinks = pgTable(
  "fiscal_document_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fiscalDocumentId: uuid("fiscal_document_id").notNull().references(() => fiscalDocuments.id, {
      onDelete: "cascade",
    }),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "set null" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    role: text("role").notNull(),
    runId: uuid("run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyDocIdx: index("fiscal_document_links_company_doc_idx").on(
      table.companyId,
      table.fiscalDocumentId,
    ),
    caseIdx: index("fiscal_document_links_case_idx").on(table.caseId),
    issueIdx: index("fiscal_document_links_issue_idx").on(table.issueId),
    roleCheck: check("fiscal_document_links_role_check", sql`${table.role} in ('origin', 'work', 'reference')`),
  }),
);
