import { routes } from "../../../routes";
import { RecordRowsScreen } from "../../RecordRowsScreen";

export const businessesRecordCode = "RC-1";

export function BusinessesScreen() {
  return (
    <RecordRowsScreen
      title="Businesses"
      recordCode={businessesRecordCode}
      titlePrompt="Trading name"
      metaPrompts={["Kind of business", "Neighbourhood"]}
      empty={{ words: "No businesses yet.", act: "Add business", to: routes.businessNew.path() }}
    />
  );
}
