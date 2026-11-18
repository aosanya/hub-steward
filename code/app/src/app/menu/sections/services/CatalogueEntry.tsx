import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuEditForm } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { homeEmpty, listOf, text, type Item } from "../staff/staffData";
import { ChatAboutService } from "./ChatAboutService";
import { ServiceDetails, ServiceEditAct, ServiceHead } from "./ServicePage";

export const servicePermission = "service.edit";

const entryReadTool = "forms_catalog_entry_read";

const publicListTool = "forms_catalog_entry_list_public";

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

const detailFields = { Name: "name", Summary: "summary", Kind: "kind", Form: "form_id" };

function CatalogueEntryPage({ entry, back, onSaved }: { entry: Item; back?: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      {back ? <ChatAboutService about={{ kind: "service", id: text(entry, "id"), name: text(entry, "name") }} back={`${back}?item=${text(entry, "id")}`} /> : null}
      <ServiceHead title={text(entry, "name")} line={text(entry, "summary")} />
      {editing ? (
        <MenuEditForm
          item={entry}
          id={text(entry, "id")}
          idArg="slug"
          tool="forms_catalog_entry_upsert"
          permission={servicePermission}
          fields={editFields}
          keep={["name", "summary", "doc"]}
          bare
          openCount={1}
          onSaved={() => {
            setEditing(false);
            onSaved();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ServiceDetails word="Details" item={entry} fields={detailFields} foot={<ServiceEditAct permission={servicePermission} onEdit={() => setEditing(true)} />} />
      )}
    </>
  );
}

export function CatalogueWindow({ title, empty, listTool = publicListTool, back }: { title: string; empty: string; listTool?: string; back?: string }) {
  const [version, setVersion] = useState(0);
  const [search] = useSearchParams();
  return (
    <MenuWindow
      title={title}
      listKey={version}
      detailKey={version}
      startAt={search.get("item") ?? undefined}
      withTabs
      bandless
      list={{ title, tool: listTool, fields: { title: "name", meta: "line" }, empty: homeEmpty(empty), load: async () => (await listOf(listTool)).map(entryRow) }}
      detail={{
        tool: entryReadTool,
        fields: {},
        status: "",
        load: loadEntry,
        extra: (entry) => <CatalogueEntryPage entry={entry} back={back} onSaved={() => setVersion((was) => was + 1)} />,
      }}
    />
  );
}
