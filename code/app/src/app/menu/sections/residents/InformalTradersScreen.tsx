import { routes } from "../../../routes";
import type { RecordFormField } from "../../RecordRowForm";
import { RecordRowsScreen } from "../../RecordRowsScreen";

export const informalTradersRecordCode = "RC-2";

export const informalTraderFields: RecordFormField[] = [
  { prompt: "Name or alias", required: true },
  { prompt: "What is sold", required: true },
  { prompt: "Usual place", required: false },
  { prompt: "Usual days", required: false },
  { prompt: "Neighbourhood", required: true, options: ["Óváros", "Kertváros", "Malomsor", "Határrét"] },
  { prompt: "Status", required: true, options: ["Active", "Suspended", "Closed"] },
];

export function InformalTradersScreen() {
  return (
    <RecordRowsScreen
      title="Informal traders"
      recordCode={informalTradersRecordCode}
      titlePrompt="Name or alias"
      prompts={informalTraderFields.map((field) => field.prompt)}
      metaPrompts={["What is sold", "Neighbourhood"]}
      empty={{ words: "No informal traders yet.", act: "Add trader", to: routes.informalTraderNew.path() }}
    />
  );
}
