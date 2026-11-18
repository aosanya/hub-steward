import { routes } from "../../../routes";
import type { RecordFormField } from "../../RecordRowForm";
import { RecordRowsScreen } from "../../RecordRowsScreen";
import { useRegisterFields } from "../../registerDetails";
import { RecordEditScreen } from "../../RecordEditScreen";
import { residentPaths } from "./paths";

export const businessesRecordCode = "RC-1";
export const businessesTitlePrompt = "Trading name";
export const businessesMetaPrompts = ["Kind of business", "Neighbourhood"];

export const businessFields: RecordFormField[] = [
  { prompt: "Trading name", required: true },
  { prompt: "Kind of business", required: true },
  { prompt: "Tax number", required: true },
  { prompt: "Registration number", required: false },
  { prompt: "Place", required: false },
  { prompt: "Neighbourhood", required: true, options: ["Óváros", "Kertváros", "Malomsor", "Határrét"] },
  { prompt: "Status", required: true, options: ["Active", "Suspended", "Closed"] },
  { prompt: "Owner", required: false, people: true },
];

export const useBusinessFields = () => useRegisterFields(businessesRecordCode, businessFields);

export function BusinessesScreen() {
  const fields = useBusinessFields();
  return (
    <RecordRowsScreen
      title="Businesses"
      recordCode={businessesRecordCode}
      titlePrompt={businessesTitlePrompt}
      detailWord="Business detail"
      prompts={fields.filter((field) => !field.people).map((field) => field.prompt)}
      metaPrompts={businessesMetaPrompts}
      owner={{ prompt: "Owner", heading: "Owner" }}
      licence
      editPath={(id) => residentPaths.businessEdit.path({ id })}
      empty={{ words: "No businesses yet.", act: "Add business", to: routes.businessNew.path() }}
    />
  );
}

export function BusinessEditScreen() {
  return <RecordEditScreen title="Edit business" recordCode={businessesRecordCode} fields={useBusinessFields()} back={{ to: (id) => residentPaths.businesses.path({ row: id }), label: "Businesses" }} />;
}
