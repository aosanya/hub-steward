import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { CommitteeMembers } from "./CommitteeMembers";
import { CouncilPage, DetailCard } from "./CouncilPage";
import { noneYet, text, type Item } from "./councilData";
import { committeesTool, loadCommittee, loadCommittees } from "./committeesData";

export const committeesTitle = "Committees";

const empty = (words: string) => ({ words, act: "Home", to: agencyHomePath(openAgencyId()) });

function CommitteePage({ committee, onChanged }: { committee: Item; onChanged: () => void }) {
  return (
    <CouncilPage name={text(committee, "name")} line={text(committee, "chair")}>
      <DetailCard word="Committee detail" item={committee} kind="committees" permission="group.manage" rows={[["Name", text(committee, "name")], ["Chair", text(committee, "chair")]]} />
      <CommitteeMembers groupId={text(committee, "id")} onChanged={onChanged} />
    </CouncilPage>
  );
}

export function CommitteesScreen() {
  const word = useWord("council");
  const title = word(committeesTitle);
  const [version, setVersion] = useState(0);
  const [search] = useSearchParams();
  const changed = () => setVersion((was) => was + 1);
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      startAt={search.get("id") ?? undefined}
      listKey={version}
      detailKey={version}
      list={{ title, tool: committeesTool, load: loadCommittees, fields: { title: "name", meta: "chair" }, empty: empty(noneYet(word, committeesTitle, "No committees yet.")) }}
      detail={{ tool: committeesTool, load: loadCommittee, fields: {}, status: "", extra: (committee) => <CommitteePage committee={committee} onChanged={changed} /> }}
    />
  );
}
