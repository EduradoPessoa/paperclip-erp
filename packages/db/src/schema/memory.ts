import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { MemoryScope, MemorySourceRef } from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

/**
 * Execution memory control plane — Paperclip ERP.
 *
 * Follows `doc/plans/2026-03-17-memory-service-surface-api.md`: Paperclip owns
 * bindings, resolution, provenance and the audited operation trail; providers
 * own extraction/storage. `memoryOperations` is append-only by contract.
 */

export const memoryBindings = pgTable(
  "memory_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    bindingKey: text("binding_key").notNull(),
    providerKey: text("provider_key").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyKeyUq: uniqueIndex("memory_bindings_company_key_uq").on(table.companyId, table.bindingKey),
    companyIdx: index("memory_bindings_company_idx").on(table.companyId),
  }),
);

export const memoryBindingTargets = pgTable(
  "memory_binding_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    bindingId: uuid("binding_id").notNull().references(() => memoryBindings.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    targetUq: uniqueIndex("memory_binding_targets_target_uq").on(table.targetType, table.targetId),
    companyBindingIdx: index("memory_binding_targets_company_binding_idx").on(table.companyId, table.bindingId),
  }),
);

export const memoryOperations = pgTable(
  "memory_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    bindingId: uuid("binding_id").notNull().references(() => memoryBindings.id, { onDelete: "cascade" }),
    operationType: text("operation_type").notNull(),
    scope: jsonb("scope").$type<MemoryScope>().notNull(),
    sourceRef: jsonb("source_ref").$type<MemorySourceRef | null>(),
    providerRecordId: text("provider_record_id"),
    status: text("status").notNull().default("success"),
    error: text("error"),
    latencyMs: integer("latency_ms"),
    usage: jsonb("usage").$type<Record<string, unknown> | null>(),
    runId: uuid("run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    costEventId: uuid("cost_event_id"),
    actorType: text("actor_type").notNull(),
    actorUserId: text("actor_user_id"),
    actorAgentId: uuid("actor_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("memory_operations_company_created_idx").on(table.companyId, table.createdAt),
    companyTypeIdx: index("memory_operations_company_type_idx").on(table.companyId, table.operationType),
    bindingIdx: index("memory_operations_binding_idx").on(table.bindingId),
    runIdx: index("memory_operations_run_idx").on(table.runId),
  }),
);

export const memoryExtractionJobs = pgTable(
  "memory_extraction_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    bindingId: uuid("binding_id").notNull().references(() => memoryBindings.id, { onDelete: "cascade" }),
    operationId: uuid("operation_id").notNull().references(() => memoryOperations.id, { onDelete: "cascade" }),
    providerJobId: text("provider_job_id"),
    hookKind: text("hook_kind"),
    status: text("status").notNull().default("queued"),
    sourceRef: jsonb("source_ref").$type<MemorySourceRef | null>(),
    error: text("error"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("memory_extraction_jobs_company_status_idx").on(table.companyId, table.status),
    operationIdx: index("memory_extraction_jobs_operation_idx").on(table.operationId),
  }),
);
