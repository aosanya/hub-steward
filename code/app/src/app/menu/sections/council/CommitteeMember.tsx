import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { refusalWords } from "../../MenuEditForm";
import { CouncilPage } from "./CouncilPage";
import { removeMember, type Member } from "./committeeMembersData";

export const manageGroup = "group.manage";

type Props = { member: Member; onBack: () => void; onRemoved: () => void };

export function CommitteeMember({ member, onBack, onRemoved }: Props) {
  const may = useMay(manageGroup);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  const remove = async () => {
    setBusy(true);
    setRefused("");
    try {
      await removeMember(member.seat);
      onRemoved();
    } catch (error) {
      setRefused(refusalWords(error));
      setBusy(false);
    }
  };
  const foot = (
    <>
      <button type="button" className="sec-foot-item" onClick={onBack}>Back</button>
      {may ? <button type="button" className="sec-act" disabled={busy} onClick={remove}>Remove from committee</button> : null}
    </>
  );
  return (
    <CouncilPage name={member.name} line={member.role}>
      <Section word="Member" plain rows={[<ListRow key="name" title="Name" meta={member.name} />, <ListRow key="role" title="Role" meta={member.role} />]} foot={foot} />
      {refused ? <LoadFailed words={refused} /> : null}
    </CouncilPage>
  );
}
