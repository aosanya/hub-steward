import { routes } from "../../../routes";
import { RecordRowsScreen } from "../../RecordRowsScreen";

export const informalTradersRecordCode = "RC-2";

export function InformalTradersScreen() {
  return (
    <RecordRowsScreen
      title="Informal traders"
      recordCode={informalTradersRecordCode}
      titlePrompt="Name or alias"
      metaPrompts={["What is sold", "Neighbourhood"]}
      empty={{ words: "No informal traders yet.", act: "Add trader", to: routes.informalTraderNew.path() }}
    />
  );
}
