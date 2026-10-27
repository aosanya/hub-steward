import { pageModule } from "../../data/registry";
import type { OptionItem, PageRow } from "../../types";

const text = (value: unknown) => (value === undefined || value === null ? "" : String(value));

const languageOptions = (rows: PageRow[]): OptionItem[] => {
  const languages = rows[0]?.languages;
  return Array.isArray(languages) ? languages.map((code) => ({ value: text(code), label: text(code) })) : [];
};

const rowOptions = (rows: PageRow[]): OptionItem[] =>
  rows.map((row) => ({ value: text(row.id), label: text(row.group || row.title || row.id) }));

export async function pickerOptions(source: string, hubId: string): Promise<OptionItem[]> {
  const module = pageModule(source);
  if (!module) return [];
  try {
    const rows = await module.rows(hubId, {});
    return source === "general" ? languageOptions(rows) : rowOptions(rows);
  } catch {
    return [];
  }
}
