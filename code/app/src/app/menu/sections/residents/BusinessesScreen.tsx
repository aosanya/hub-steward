import { routes } from "../../../routes";
import type { RecordFormField } from "../../RecordRowForm";
import { RecordRowsScreen } from "../../RecordRowsScreen";

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
];

export function BusinessesScreen() {
  return (
    <RecordRowsScreen
      title="Businesses"
      recordCode={businessesRecordCode}
      titlePrompt={businessesTitlePrompt}
      prompts={businessFields.map((field) => field.prompt)}
      metaPrompts={businessesMetaPrompts}
      owner={{ prompt: "Owner", heading: "Owner" }}
      empty={{ words: "No businesses yet.", act: "Add business", to: routes.businessNew.path() }}
    />
  );
}
