import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuWindow } from "../../MenuWindow";
import { committeesTool, loadCommittee, loadCommittees } from "./committeesData";

export const committeesTitle = "Committees";

const empty = () => ({ words: "No committees yet.", act: "Home", to: agencyHomePath(openAgencyId()) });

export function CommitteesScreen() {
  return (
    <MenuWindow
      title={committeesTitle}
      list={{ title: committeesTitle, tool: committeesTool, load: loadCommittees, fields: { title: "name", meta: "chair" }, empty: empty() }}
      detail={{ tool: committeesTool, load: loadCommittee, fields: { Name: "name", Chair: "chair" }, status: "status" }}
    />
  );
}
