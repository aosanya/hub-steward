import { useState } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SearchBox } from "../../../../shared/ui/SearchBox";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
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
  const addButton = may && !adding ? <Button kind="primary" onClick={() => setAdding(true)}>Add member</Button> : null;
  return (
    <>
      <SectionHeading>{`Members (${roster.members.length})`}</SectionHeading>
      {roster.members.length === 0 ? <EmptyCard words="No members yet.">{addButton}</EmptyCard> : null}
      <Rows>
        {roster.members.map((member) => (
          <ListRow key={member.seat} title={member.name} meta={member.role} end={may ? <Button kind="quiet" disabled={busy} onClick={() => act(() => removeMember(member.seat))}>Remove</Button> : undefined} />
        ))}
      </Rows>
      {roster.members.length > 0 ? addButton : null}
      {may && adding ? <PersonPicker roster={roster} busy={busy} refused={refused} onAdd={add} onCancel={() => setAdding(false)} /> : null}
      {!adding && refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}
