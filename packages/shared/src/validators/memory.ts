import { z } from "zod";
import {
  MEMORY_OPERATION_STATUSES,
  MEMORY_OPERATION_TYPES,
  MEMORY_TARGET_TYPES,
} from "../constants.js";

export const memoryScopeSchema = z.object({
  companyId: z.string().guid().optional(),
  agentId: z.string().guid().optional().nullable(),
  projectId: z.string().guid().optional().nullable(),
  issueId: z.string().guid().optional().nullable(),
  runId: z.string().guid().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  sessionKey: z.string().optional().nullable(),
  namespace: z.string().optional().nullable(),
});

export const memorySourceRefSchema = z.object({
  kind: z.enum([
    "issue_comment",
    "issue_document",
    "issue",
    "run",
    "activity",
    "manual_note",
    "external_document",
    "case_event",
  ]),
  issueId: z.string().guid().optional().nullable(),
  commentId: z.string().guid().optional().nullable(),
  documentKey: z.string().optional().nullable(),
  runId: z.string().guid().optional().nullable(),
  activityId: z.string().optional().nullable(),
  externalRef: z.string().optional().nullable(),
  caseId: z.string().guid().optional().nullable(),
});

export const upsertMemoryBindingSchema = z.object({
  bindingKey: z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9-]*$/, "bindingKey must be a kebab-case slug"),
  providerKey: z.string().min(1).max(120),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

export type UpsertMemoryBinding = z.infer<typeof upsertMemoryBindingSchema>;

export const setMemoryTargetSchema = z.object({
  bindingKey: z.string().min(1).max(120),
});

export const createMemoryOperationSchema = z.object({
  bindingKey: z.string().min(1).max(120).optional(),
  operationType: z.enum(MEMORY_OPERATION_TYPES),
  scope: memoryScopeSchema.optional(),
  sourceRef: memorySourceRefSchema.optional().nullable(),
  providerRecordId: z.string().max(300).optional().nullable(),
  status: z.enum(MEMORY_OPERATION_STATUSES).optional().default("success"),
  error: z.string().max(2000).optional().nullable(),
  latencyMs: z.number().int().nonnegative().optional().nullable(),
  usage: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type CreateMemoryOperation = z.infer<typeof createMemoryOperationSchema>;

export const memoryBindingTargetTypeSchema = z.enum(MEMORY_TARGET_TYPES);
