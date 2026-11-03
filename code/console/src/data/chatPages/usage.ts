import { agencyReads, type PageChat } from "./types";

export const usagePageIds = ["usage", "usage-overview", "usage-work", "usage-agents"];

export const usageChat: PageChat = {
  reads: [...agencyReads, "ai_usage_breakdown", "ai_list_usage", "ai_list_test_run_usage", "ai_list_roles", "ai_list_accounts", "actor_list_actors"],
  writes: [],
};
