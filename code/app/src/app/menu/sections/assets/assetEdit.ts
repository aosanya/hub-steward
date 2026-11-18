import type { EditField } from "../../MenuEditForm";
import type { Choice } from "../../../../shared/ui/SearchSelect";
import { attributeKeys, attributesOf, conditionWords, withAttributes } from "./assetDetail";

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

export const editFieldsOf = (asset: Item, keepers: Choice[]): EditField[] => [
  { label: "Name", key: "name", required: true },
  { label: "Category", key: "category" },
  ...(attributesOf(asset) === null
    ? []
    : [
        { label: "Condition", key: "condition", choices: conditionWords },
        ...(keepers.length === 0 ? [] : [{ label: "Kept by", key: "keeper", choices: keepers }]),
      ]),
];

export const updateOf = (asset: Item) => (sent: Record<string, unknown>) => {
  const attributes = withAttributes(asset, Object.fromEntries(attributeKeys.filter((key) => key in sent).map((key) => [key, sent[key]])));
  return {
    assetID: textOf(asset.id),
    name: sent.name ?? textOf(asset.name),
    category: sent.category ?? textOf(asset.category),
    ...(textOf(asset.serial_tag) === "" ? {} : { serial_tag: textOf(asset.serial_tag) }),
    ...(attributes === "" ? {} : { attributes_json: attributes }),
    ...(textOf(asset.updated_at) === "" ? {} : { version: textOf(asset.updated_at) }),
  };
};
