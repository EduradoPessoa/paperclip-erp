import type { AgentActivityFeed } from "@paperclipai/shared";
import { api } from "./client";

export { type AgentActivityFeed } from "@paperclipai/shared";

export const agentActivityApi = {
  feed: (companyId: string, limit = 50) =>
    api.get<AgentActivityFeed>(`/companies/${companyId}/agents/activity-feed?limit=${limit}`),
};
