import { RecordRowForm } from "../../RecordRowForm";
import { informalTradersRecordCode, useInformalTraderFields } from "./InformalTradersScreen";
import { residentPaths } from "./paths";

export function InformalTraderNewScreen() {
  return <RecordRowForm title="Add trader" recordCode={informalTradersRecordCode} fields={useInformalTraderFields()} back={{ to: residentPaths.informalTraders.path(), label: "Informal traders" }} />;
}
