import { RecordRowForm } from "../../RecordRowForm";
import { businessesRecordCode, businessFields } from "./BusinessesScreen";
import { residentPaths } from "./paths";

export function BusinessNewScreen() {
  return <RecordRowForm title="Add business" recordCode={businessesRecordCode} fields={businessFields} back={{ to: residentPaths.businesses.path(), label: "Businesses" }} />;
}
