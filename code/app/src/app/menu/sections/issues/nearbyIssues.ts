import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";

type Item = Record<string, unknown>;

export const nearbyTool = "forms_catalog_raised_item_list_nearby";

export const topicsSettingKey = "issue_topics";

export const wholeEarthInMetres = 20_100_000;

const anywhere = [0, 0];

const text = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const settingTopics = async (): Promise<string[]> => {
  try {
    const reply = (await callTool("", "forms_catalog_setting_read", { key: topicsSettingKey })) as Item | null;
    return text(reply ?? {}, "value").split(",");
  } catch {
    return [];
  }
};

const ownTopics = async (): Promise<string[]> => {
  try {
    return (itemsOf(await callTool("", "forms_catalog_raised_item_list_mine")) as Item[]).map((item) => text(item, "topic"));
  } catch {
    return [];
  }
};

export const issueTopics = async (): Promise<string[]> => {
  const named = [...(await settingTopics()), ...(await ownTopics())].map((topic) => topic.trim()).filter(Boolean);
  return [...new Set(named)];
};

export const nearbyIssues = async (): Promise<Item[]> => {
  const found = new Map<string, Item>();
  for (const topic of await issueTopics()) {
    const rows = itemsOf(await callTool("", nearbyTool, { topic, at: anywhere, within: wholeEarthInMetres })) as Item[];
    rows.forEach((row, at) => found.set(text(row, "id") || `${topic}:${at}`, row));
  }
  return [...found.values()];
};
