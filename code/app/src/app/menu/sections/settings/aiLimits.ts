export type LimitField = [key: string, label: string];

export const agentLimitFields: LimitField[] = [
  ["tokens_per_call", "Tokens per call"],
  ["tokens_per_day", "Tokens per day"],
  ["tokens_per_week", "Tokens per week"],
  ["tokens_per_month", "Tokens per month"],
  ["requests_per_minute", "Requests per minute"],
  ["requests_per_day", "Requests per day"],
  ["requests_per_week", "Requests per week"],
  ["tokens_per_test", "Tokens per test"],
  ["scenarios_at_once", "Scenarios at once"],
];

export const personLimitFields: LimitField[] = [
  ["tokens_per_person_day", "Each person a day"],
  ["tokens_per_person_month", "Each person a month"],
  ["owner_tokens_per_person_day", "The owner a day"],
  ["owner_tokens_per_person_month", "The owner a month"],
];

export const everyoneId = "everyone";

export const limitsPermission = (id: string) => (id === everyoneId ? "ai.account.manage" : "ai.role.manage");
