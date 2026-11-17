import { RecordRowForm, type RecordFormField } from "../../RecordRowForm";
import { businessesRecordCode } from "./BusinessesScreen";
import { residentPaths } from "./paths";

const businessFields: RecordFormField[] = [
  { prompt: "Trading name", required: true },
  { prompt: "Kind of business", required: true },
  { prompt: "Tax number", required: true },
  { prompt: "Registration number", required: false },
  { prompt: "Place", required: false },
  { prompt: "Neighbourhood", required: true, options: ["Óváros", "Kertváros", "Malomsor", "Határrét"] },
  { prompt: "Status", required: true, options: ["Active", "Suspended", "Closed"] },
];

export function BusinessNewScreen() {
  return <RecordRowForm title="Add business" recordCode={businessesRecordCode} fields={businessFields} back={{ to: residentPaths.businesses.path(), label: "Businesses" }} />;
}
