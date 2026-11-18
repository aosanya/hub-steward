import { useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { FormScreen } from "../../FormScreen";
import { servicePermission, loadEntry } from "./CatalogueEntry";
import { editFieldsFor, loadCatalogueChoices } from "./catalogueChoices";
import { slugOf } from "./catalogueSlug";
import { servicesPaths } from "./paths";

const entryArgs = (sent: Record<string, unknown>) => ({
  ...sent,
  slug: slugOf(String(sent.name ?? "")),
  doc: JSON.stringify({ ...(sent.kind ? { kind: sent.kind } : {}), ...(sent.form_id ? { form_id: sent.form_id } : {}) }),
});

const noChoices = { kinds: [], forms: [] };

const upsertTool = "forms_catalog_entry_upsert";

export function ServiceFormScreen() {
  const { slug = "" } = useParams();
  const choices = useLoad(loadCatalogueChoices, `catalogue-choices:${openAgencyId()}`);
  const known = choices.state === "ready" ? choices.data : noChoices;
  return (
    <FormScreen
      id={slug}
      word="service"
      listLabel="Service Catalogue"
      addedTo={servicesPaths.catalogue.path()}
      editedTo={servicesPaths.catalogue.path({ item: slug })}
      permission={servicePermission}
      load={loadEntry}
      nameOf={(entry) => (typeof entry.name === "string" ? entry.name : "")}
      addTool={upsertTool}
      addBuild={entryArgs}
      editTool={upsertTool}
      idArg="slug"
      keep={["name", "summary", "doc"]}
      fields={(entry) => editFieldsFor(entry, known)}
    />
  );
}
