import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { noneYet } from "./councilData";
import { committeesTool, loadCommittee, loadCommittees } from "./committeesData";

export const committeesTitle = "Committees";

const empty = (words: string) => ({ words, act: "Home", to: agencyHomePath(openAgencyId()) });

export function CommitteesScreen() {
  const word = useWord("council");
  const title = word(committeesTitle);
  return (
    <MenuWindow
      title={title}
      list={{ title, tool: committeesTool, load: loadCommittees, fields: { title: "name", meta: "chair" }, empty: empty(noneYet(word, committeesTitle, "No committees yet.")) }}
      detail={{ tool: committeesTool, load: loadCommittee, fields: { Name: "name", Chair: "chair" }, status: "status" }}
    />
  );
}
