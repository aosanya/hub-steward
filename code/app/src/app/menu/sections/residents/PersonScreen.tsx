import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { ChooseSheet } from "./ChooseSheet";
import { EmptyActCard } from "./EmptyActCard";
import { PersonActivity } from "./PersonActivity";
import { PersonEdit } from "./PersonEdit";
import { PersonBills } from "./PersonBills";
import { PersonHoldings } from "./PersonHoldings";
import { PersonApplications, PersonRecords } from "./PersonLinks";
import { PersonRaised } from "./PersonRaised";
import { residentPaths } from "./paths";
import { personNameOf } from "./personName";
import { useOpenFromPanel } from "./useOpenFromPanel";

type Item = Record<string, unknown>;

export const loadPerson = async (id: string) => {
  const reply = (await callTool("", "actor_get_actor", { actor_id: id })) as { item?: Item } | Item | null;
  const person = (reply as { item?: Item } | null)?.item ?? reply;
  const found = (person && typeof person === "object" ? person : {}) as Item;
  return { ...found, id, display_name: personNameOf(found) };
};

const groupNameOf = (group: Item) => (typeof group.name === "string" ? group.name : "");

const loadGroupChoices = async () => (itemsOf(await callTool("", "actor_list_groups")) as Item[]).map((group) => ({ id: String(group.id ?? ""), title: groupNameOf(group) })).filter((choice) => choice.id && choice.title);

const loadMemberships = (id: string) => async () => {
  const [memberships, groups] = await Promise.all([callTool("", "actor_list_groups_for_actor", { actor_id: id }), loadGroupChoices()]);
  const nameById = new Map(groups.map((group) => [group.id, group.title]));
  return (itemsOf(memberships) as Item[]).flatMap((membership) => {
    const groupId = String(membership.group_id ?? "");
    const name = nameById.get(groupId);
    return name ? [{ id: groupId, name }] : [];
  });
};

function PersonGroups({ id }: { id: string }) {
  const word = useWord("actor");
  const open = useOpenFromPanel();
  const [version, setVersion] = useState(0);
  const view = useLoad(loadMemberships(id), `person-groups:${openAgencyId()}:${id}:${version}`);
  const groups = view.state === "ready" ? view.data : [];
  const addTitle = `Add to a ${word("Group").toLowerCase()}`;
  return (
    <>
      <SectionHeading>{word("Groups")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={`The ${word("Groups").toLowerCase()} could not be loaded.`} /> : null}
      {view.state === "ready" && groups.length === 0 ? (
        <EmptyActCard
          words={`Not in any ${word("Group").toLowerCase()} yet.`}
          permission="group.manage"
          act={addTitle}
          sheet={(close) => (
            <ChooseSheet
              title={addTitle}
              loadKey="person-group-choices"
              load={loadGroupChoices}
              onClose={close}
              onChoose={async (groupId) => {
                await callTool("", "actor_assign_group", { actor_id: id, group_id: groupId });
                close();
                setVersion((was) => was + 1);
              }}
            />
          )}
        />
      ) : null}
      {groups.length > 0 ? (
        <Rows>
          {groups.map((group) => (
            <ListRow key={group.id} title={group.name} onClick={() => open(residentPaths.groups.path({ group: group.id }))} end="›" />
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
