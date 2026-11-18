import type { Choice } from "../../../../shared/ui/SearchSelect";
import { callTool } from "../../../../shared/wakala/mcp";
import { loadFormList } from "../../formList";
import type { EditField } from "../../MenuEditForm";
import { text, type Item } from "../staff/staffData";

export const missingFormWords = "A form that no longer exists";

const kindsKey = "kinds";

const isItem = (value: unknown): value is Item => typeof value === "object" && value !== null;

const kindNamesOf = (value: unknown): string[] => {
  try {
    const parsed: unknown = JSON.parse(typeof value === "string" ? value : "");
    return Array.isArray(parsed) ? parsed.filter(isItem).map((kind) => text(kind, "name")).filter((name) => name !== "") : [];
  } catch {
    return [];
  }
};

const loadKindNames = async () => kindNamesOf(((await callTool("", "forms_catalog_setting_read", { key: kindsKey }).catch(() => null)) as Item | null)?.value);

const loadForms = async (): Promise<Choice[]> =>
  (await loadFormList().catch(() => [])).map((form) => ({ value: form.id, label: form.title }));

export type CatalogueChoices = { kinds: string[]; forms: Choice[] };

export const loadCatalogueChoices = async (): Promise<CatalogueChoices> => ({ kinds: await loadKindNames(), forms: await loadForms() });

export const formTitleOf = (formId: string, forms: Choice[]) => (formId === "" ? "" : (forms.find((form) => form.value === formId)?.label ?? missingFormWords));

const withCurrent = (choices: Choice[], current: string, label: string) =>
  current === "" || choices.some((choice) => choice.value === current) ? choices : [...choices, { value: current, label }];

export const editFieldsFor = (entry: Item, { kinds, forms }: CatalogueChoices): EditField[] => {
  const kindChoices = withCurrent(kinds.map((name) => ({ value: name, label: name })), text(entry, "kind"), text(entry, "kind"));
  const formChoices = withCurrent(forms, text(entry, "form_id"), missingFormWords);
  return [
    { label: "Name", key: "name", required: true },
    { label: "Summary", key: "summary" },
    ...(kindChoices.length > 0 ? [{ label: "Kind", key: "kind", choices: kindChoices }] : []),
    ...(formChoices.length > 0 ? [{ label: "Form", key: "form_id", choices: formChoices }] : []),
  ];
};
