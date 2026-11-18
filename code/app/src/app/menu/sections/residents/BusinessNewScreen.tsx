import { RecordRowForm } from "../../RecordRowForm";
import { businessesRecordCode, useBusinessFields } from "./BusinessesScreen";
import { residentPaths } from "./paths";

export function BusinessNewScreen() {
  return <RecordRowForm title="Add business" recordCode={businessesRecordCode} fields={useBusinessFields()} back={{ to: residentPaths.businesses.path(), label: "Businesses" }} />;
}
