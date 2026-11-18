import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SearchBox } from "../../../../shared/ui/SearchBox";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";
import { addMember, loadRoster, removeMember, type Person, type Roster } from "./committeeMembersData";

const manageGroup = "group.manage";

const noMemberSeatWords = "This hub has no Member seat to give.";

const matches = (person: Person, search: string) => person.name.toLowerCase().includes(search.trim().toLowerCase());

type PickerProps = { roster: Roster; busy: boolean; refused: string; onAdd: (person: Person) => void; onCancel: () => void };

function PersonPicker({ roster, busy, refused, onAdd, onCancel }: PickerProps) {
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Person | null>(null);
  const seated = new Set(roster.members.map((member) => member.actor));
  const found = roster.people.filter((person) => !seated.has(person.id) && matches(person, search));
  return (
    <>
      <SearchBox label="Search people" value={search} onChange={setSearch} />
      <Rows>
        {found.map((person) => (
          <ListRow key={person.id} title={person.name} pressed={chosen?.id === person.id} onClick={() => setChosen(person)} />
        ))}
      </Rows>
      {chosen ? <Button kind="primary" disabled={busy} onClick={() => onAdd(chosen)}>{`Add ${chosen.name}`}</Button> : null}
      <Button kind="quiet" disabled={busy} onClick={onCancel}>Cancel</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

export function CommitteeMembers({ groupId, onChanged }: { groupId: string; onChanged?: () => void }) {
  const may = useMay(manageGroup);
  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  const view = useLoad(() => loadRoster(groupId), `committee-members:${openAgencyId()}:${groupId}:${version}`);
  const act = async (run: () => Promise<unknown>, done?: () => void) => {
    setBusy(true);
    setRefused("");
    try {
      await run();
      done?.();
      setVersion((was) => was + 1);
      onChanged?.();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setBusy(false);
    }
  };
  if (view.state === "loading") return <LoadingLine />;
  if (view.state === "error") return <LoadFailed words="The members could not be loaded." />;
  const roster = view.data;
  const add = (person: Person) =>
    roster.memberKind === "" ? setRefused(noMemberSeatWords) : act(() => addMember(groupId, person.id, roster.memberKind), () => setAdding(false));
  const addAct = may && !adding ? <button type="button" className="sec-act" onClick={() => setAdding(true)}>Add member</button> : null;
  return (
    <>
      <Section
        word="Members"
        icon="users"
        all
        foot={addAct}
        empty={{ words: "No members yet." }}
        rows={roster.members.map((member) => (
          <ListRow key={member.seat} title={member.name} meta={member.role} end={may ? <Button kind="quiet" disabled={busy} onClick={() => act(() => removeMember(member.seat))}>Remove</Button> : undefined} />
        ))}
      />
      {may && adding ? <PersonPicker roster={roster} busy={busy} refused={refused} onAdd={add} onCancel={() => setAdding(false)} /> : null}
      {!adding && refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}
