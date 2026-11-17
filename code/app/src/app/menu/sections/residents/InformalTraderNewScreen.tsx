import { RecordRowForm } from "../../RecordRowForm";
import { informalTradersRecordCode, informalTraderFields } from "./InformalTradersScreen";
import { residentPaths } from "./paths";

export function InformalTraderNewScreen() {
  return <RecordRowForm title="Add trader" recordCode={informalTradersRecordCode} fields={informalTraderFields} back={{ to: residentPaths.informalTraders.path(), label: "Informal traders" }} />;
}
