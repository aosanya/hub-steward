import { useState } from "react";
import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { GroupEdit } from "../staff/GroupEdit";
import { CommitteeMembers } from "./CommitteeMembers";
import { noneYet } from "./councilData";
import { committeesTool, loadCommittee, loadCommittees } from "./committeesData";

export const committeesTitle = "Committees";

const empty = (words: string) => ({ words, act: "Home", to: agencyHomePath(openAgencyId()) });

export function CommitteesScreen() {
  const word = useWord("council");
  const title = word(committeesTitle);
  const [version, setVersion] = useState(0);
  const changed = () => setVersion((was) => was + 1);
  return (
    <MenuWindow
      title={title}
      listKey={version}
      detailKey={version}
      list={{ title, tool: committeesTool, load: loadCommittees, fields: { title: "name", meta: "chair" }, empty: empty(noneYet(word, committeesTitle, "No committees yet.")) }}
      detail={{
        tool: committeesTool,
        load: loadCommittee,
        fields: { Name: "name", Chair: "chair" },
        status: "status",
        extra: (committee) => (
          <>
            <GroupEdit group={committee} onSaved={changed} />
            <CommitteeMembers groupId={String(committee.id ?? "")} onChanged={changed} />
          </>
        ),
      }}
    />
  );
}
