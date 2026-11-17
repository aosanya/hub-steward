import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { PersonActivity } from "./PersonActivity";
import { PersonEdit } from "./PersonEdit";
import { PersonBills } from "./PersonBills";
import { PersonHoldings } from "./PersonHoldings";
import { PersonApplications, PersonRecords } from "./PersonLinks";
import { PersonRaised } from "./PersonRaised";
import { personNameOf } from "./personName";

type Item = Record<string, unknown>;

export const loadPerson = async (id: string) => {
  const reply = (await callTool("", "actor_get_actor", { actor_id: id })) as { item?: Item } | Item | null;
  const person = (reply as { item?: Item } | null)?.item ?? reply;
  const found = (person && typeof person === "object" ? person : {}) as Item;
  return { ...found, id, display_name: personNameOf(found) };
};

const loadGroupNames = (id: string) => async () => {
  const [memberships, groups] = await Promise.all([callTool("", "actor_list_groups_for_actor", { actor_id: id }), callTool("", "actor_list_groups")]);
  const nameById = new Map((itemsOf(groups) as Item[]).map((group) => [String(group.id ?? ""), typeof group.name === "string" ? group.name : ""]));
  return (itemsOf(memberships) as Item[]).map((membership) => nameById.get(String(membership.group_id ?? "")) ?? "").filter(Boolean);
};

function PersonGroups({ id }: { id: string }) {
  const word = useWord("actor");
  const view = useLoad(loadGroupNames(id), `person-groups:${openAgencyId()}:${id}`);
  const names = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>{word("Groups")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={`The ${word("Groups").toLowerCase()} could not be loaded.`} /> : null}
      {view.state === "ready" && names.length === 0 ? <EmptyCard words={`Not in any ${word("Group").toLowerCase()} yet.`} /> : null}
      {names.length > 0 ? (
        <Rows>
          {names.map((name) => (
            <ListRow key={name} title={name} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}

export function PersonPanel({ person, onSaved }: { person: Item; onSaved: () => void }) {
  const id = String(person.id ?? "");
  return (
    <>
      <PersonEdit id={id} person={person} onSaved={onSaved} />
      <PersonGroups id={id} />
      <PersonApplications id={id} />
      <PersonRaised id={id} />
      <PersonBills id={id} />
      <PersonRecords id={id} />
      <PersonHoldings id={id} />
      <PersonActivity id={id} />
    </>
  );
}
