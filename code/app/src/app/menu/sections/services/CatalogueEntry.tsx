import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { AddButton } from "../../AddButton";
import { MenuEditForm } from "../../MenuEditForm";
import { MenuWindow } from "../../MenuWindow";
import { homeEmpty, listOf, text, type Item } from "../staff/staffData";
import { ChatAboutService } from "./ChatAboutService";
import { editFieldsFor, formTitleOf, loadCatalogueChoices } from "./catalogueChoices";
import { ServiceDetails, ServiceEditAct, ServiceHead } from "./ServicePage";

export const servicePermission = "service.edit";

const entryReadTool = "forms_catalog_entry_read";

const publicListTool = "forms_catalog_entry_list_public";

const entryRow = (entry: Item) => ({ id: text(entry, "slug") || text(entry, "id"), name: text(entry, "name"), line: text(entry, "summary") });

const loadEntry = async (slug: string): Promise<Item> => {
  const reply = (await callTool("", entryReadTool, { slug })) as { item?: Item } | null;
  const entry = reply?.item ?? (reply as Item | null) ?? {};
  return { ...entry, id: slug };
};

const detailFields = { Name: "name", Summary: "summary", Kind: "kind", Form: "form_title" };

function CatalogueEntryPage({ entry, back, onSaved }: { entry: Item; back?: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const choices = useLoad(loadCatalogueChoices, `catalogue-choices:${openAgencyId()}`);
  const shown = choices.state === "ready" ? { ...entry, form_title: formTitleOf(text(entry, "form_id"), choices.data.forms) } : entry;
  return (
    <>
      {back ? <ChatAboutService about={{ kind: "service", id: text(entry, "id"), name: text(entry, "name") }} back={`${back}?item=${text(entry, "id")}`} /> : null}
      <ServiceHead title={text(entry, "name")} line={text(entry, "summary")} />
      {editing && choices.state === "ready" ? (
        <MenuEditForm
          item={entry}
          id={text(entry, "id")}
          idArg="slug"
          tool="forms_catalog_entry_upsert"
          permission={servicePermission}
          fields={editFieldsFor(entry, choices.data)}
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
        <ServiceDetails word="Details" item={shown} fields={detailFields} foot={<ServiceEditAct permission={servicePermission} onEdit={() => setEditing(true)} />} />
      )}
    </>
  );
}

type WindowProps = { title: string; empty: string; listTool?: string; back?: string; add?: { label: string; to: string } };

export function CatalogueWindow({ title, empty, listTool = publicListTool, back, add }: WindowProps) {
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
      above={add ? <AddButton permission={servicePermission} label={add.label} to={add.to} /> : undefined}
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
