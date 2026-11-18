import { useLoad } from "../../../../features/forms/useLoad";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { AddScreen } from "../../AddScreen";
import { editFieldsFor, loadCatalogueChoices } from "./catalogueChoices";
import { slugOf } from "./catalogueSlug";
import { servicePermission } from "./CatalogueEntry";
import { servicesPaths } from "./paths";

const entryArgs = (sent: Record<string, unknown>) => ({
  ...sent,
  slug: slugOf(String(sent.name ?? "")),
  doc: JSON.stringify({ ...(sent.kind ? { kind: sent.kind } : {}), ...(sent.form_id ? { form_id: sent.form_id } : {}) }),
});

const noChoices = { kinds: [], forms: [] };

export function ServiceNewScreen() {
  const choices = useLoad(loadCatalogueChoices, `catalogue-choices:${openAgencyId()}`);
  return (
    <AddScreen
      title="Add service"
      backLabel="Service Catalogue"
      backTo={servicesPaths.catalogue.path()}
      permission={servicePermission}
      tool="forms_catalog_entry_upsert"
      fields={editFieldsFor({}, choices.state === "ready" ? choices.data : noChoices)}
      build={entryArgs}
    />
  );
}
