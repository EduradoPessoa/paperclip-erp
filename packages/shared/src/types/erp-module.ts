import type { ErpModuleKey } from "../constants.js";

export interface ErpModule {
  id: string;
  companyId: string;
  moduleKey: ErpModuleKey;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  installedByUserId: string | null;
  installedAt: string;
  updatedAt: string;
}
