import { itemsOf } from "../../../../features/backlogs";
import { dayWithYearWords } from "../../../../shared/ui/days";
import { callTool } from "../../../../shared/wakala/mcp";
import type { EditField } from "../../MenuEditForm";

type Item = Record<string, unknown>;

const dayRange = "date";

const textRange = "text";

export const loadPersonProperties = async (): Promise<EditField[]> =>
  (itemsOf(await callTool("", "actor_list_attribute_properties")) as Item[])
    .filter((property) => typeof property.name === "string" && (property.range === textRange || property.range === dayRange))
    .map((property) => ({
      key: String(property.name),
      label: String(property.label ?? property.name),
      required: property.required === true,
      ...(property.range === dayRange ? { kind: "date" as const, day: true } : {}),
    }));

export const propertyWords = (field: EditField, value: unknown) => (field.kind === "date" && typeof value === "string" ? dayWithYearWords(value) : String(value));
