import { RecordRowForm, type RecordFormField } from "../../RecordRowForm";
import { informalTradersRecordCode } from "./InformalTradersScreen";
import { residentPaths } from "./paths";

const informalTraderFields: RecordFormField[] = [
  { prompt: "Name or alias", required: true },
  { prompt: "What is sold", required: true },
  { prompt: "Usual place", required: false },
  { prompt: "Usual days", required: false },
  { prompt: "Neighbourhood", required: true, options: ["Óváros", "Kertváros", "Malomsor", "Határrét"] },
  { prompt: "Status", required: true, options: ["Active", "Suspended", "Closed"] },
];

export function InformalTraderNewScreen() {
  return <RecordRowForm title="Add trader" recordCode={informalTradersRecordCode} fields={informalTraderFields} back={{ to: residentPaths.informalTraders.path(), label: "Informal traders" }} />;
}
