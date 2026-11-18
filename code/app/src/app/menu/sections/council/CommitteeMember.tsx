import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { refusalWords } from "../../MenuEditForm";
import { CouncilPage } from "./CouncilPage";
import { removeMember, type Member } from "./committeeMembersData";

export const manageGroup = "group.manage";

const removeMemberPermission = "member.remove";

type Props = { groupId: string; committee: string; member: Member; onBack: () => void; onRemoved: () => void };

export function CommitteeMember({ groupId, committee, member, onBack, onRemoved }: Props) {
  const may = useMay(removeMemberPermission);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState("");
  const remove = async () => {
    setBusy(true);
    setRefused("");
    try {
      await removeMember(groupId, member.actor);
      onRemoved();
    } catch (error) {
      setRefused(refusalWords(error));
      setBusy(false);
    }
  };
  const detail = [<ListRow key="name" title="Name" meta={member.name} />, <ListRow key="role" title="Role" meta={member.role} />];
  const question = <ListRow key="ask" title={`Remove ${member.name} from ${committee}?`} meta="They also leave the committee's member list." />;
  const askFoot = (
    <>
      <button type="button" className="sec-foot-item" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
      <button type="button" className="sec-act" disabled={busy} onClick={remove}>{`Remove ${member.name}`}</button>
    </>
  );
  const foot = asking ? askFoot : (
    <>
      <button type="button" className="sec-foot-item" onClick={onBack}>Back</button>
      {may ? <button type="button" className="sec-act" disabled={busy} onClick={() => setAsking(true)}>Remove from committee</button> : null}
    </>
  );
  return (
    <CouncilPage name={member.name} line={member.role}>
      <Section word="Member" plain rows={asking ? [...detail, question] : detail} foot={foot} />
      {refused ? <LoadFailed words={refused} /> : null}
    </CouncilPage>
  );
}
