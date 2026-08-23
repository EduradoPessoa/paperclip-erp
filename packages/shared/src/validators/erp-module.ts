import { z } from "zod";
import { ERP_MODULE_KEYS } from "../constants.js";

export const installErpModuleSchema = z.object({
  moduleKey: z.enum(ERP_MODULE_KEYS),
  name: z.string().min(1).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

export type InstallErpModule = z.infer<typeof installErpModuleSchema>;

export const updateErpModuleSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateErpModule = z.infer<typeof updateErpModuleSchema>;
