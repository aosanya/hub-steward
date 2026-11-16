import { useState } from "react";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuEditForm } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { homeEmpty, listOf, text, type Item } from "../staff/staffData";

export const servicePermission = "service.edit";

const entryReadTool = "forms_catalog_entry_read";

const listTool = "forms_catalog_entry_list_public";

const editFields = [
  { label: "Name", key: "name", required: true },
  { label: "Line", key: "summary" },
  { label: "Kind", key: "kind" },
  { label: "Form id", key: "form_id" },
];

const entryRow = (entry: Item) => ({ id: text(entry, "slug") || text(entry, "id"), name: text(entry, "name"), line: text(entry, "summary") });

const loadEntry = async (slug: string): Promise<Item> => {
  const reply = (await callTool("", entryReadTool, { slug })) as { item?: Item } | null;
  const entry = reply?.item ?? (reply as Item | null) ?? {};
  return { ...entry, id: slug };
};

export function CatalogueWindow({ title, empty }: { title: string; empty: string }) {
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      title={title}
      listKey={version}
      detailKey={version}
      list={{ title, tool: listTool, fields: { title: "name", meta: "line" }, empty: homeEmpty(empty), load: async () => (await listOf(listTool)).map(entryRow) }}
      detail={{
        tool: entryReadTool,
        fields: { Kind: "kind", Form: "form_id" },
        status: "",
        load: loadEntry,
        extra: (entry) => (
          <MenuEditForm
            item={entry}
            id={text(entry, "id")}
            idArg="slug"
            tool="forms_catalog_entry_upsert"
            permission={servicePermission}
            fields={editFields}
            keep={["name", "summary", "doc"]}
            onSaved={() => setVersion((was) => was + 1)}
          />
        ),
      }}
    />
  );
}
