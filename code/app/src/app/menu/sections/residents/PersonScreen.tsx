import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { ChooseSheet } from "./ChooseSheet";
import { SectionAct, SectionGo } from "./SectionAct";
import { PersonActivity } from "./PersonActivity";
import { usePersonAttributes } from "./PersonAttributesEdit";
import { PersonBills } from "./PersonBills";
import { PersonHoldings } from "./PersonHoldings";
import { PersonApplications, PersonRecords } from "./PersonLinks";
import { PersonRaised } from "./PersonRaised";
import { residentPaths } from "./paths";
import { personNameOf } from "./personName";
import { useOpenFromPanel } from "./useOpenFromPanel";
import { useOpenSection } from "./personSections";

type Item = Record<string, unknown>;

export const readActor = async (id: string) => {
  const reply = (await callTool("", "actor_get_actor", { actor_id: id })) as { item?: Item } | Item | null;
  const person = (reply as { item?: Item } | null)?.item ?? reply;
  return (person && typeof person === "object" ? person : {}) as Item;
};

export const loadPerson = async (id: string) => {
  const found = await readActor(id);
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

export function PersonGroups({ id, full }: { id: string; full?: boolean }) {
  const opens = useOpenSection(id, "groups");
  const word = useWord("actor");
  const open = useOpenFromPanel();
  const [version, setVersion] = useState(0);
  const view = useLoad(loadMemberships(id), `person-groups:${openAgencyId()}:${id}:${version}`);
  const groups = view.state === "ready" ? view.data : [];
  const addTitle = `Add to a ${word("Group").toLowerCase()}`;
  const act = (
    <SectionAct
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
  );
  return (
    <>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={`The ${word("Groups").toLowerCase()} could not be loaded.`} /> : null}
      {view.state === "ready" ? (
        <Section
          icon="users"
          word={word("Groups")}
          full={full}
          opens={opens}
          foot={act}
          empty={{ words: `Not in any ${word("Group").toLowerCase()} yet.` }}
          rows={groups.map((group) => (
            <ListRow key={group.id} title={group.name} onClick={() => open(residentPaths.groups.path({ group: group.id }))} end="›" />
          ))}
        />
      ) : null}
    </>
  );
}

const contactOrder = ["email", "phone"];

const contactRank = (key: string) => {
  const at = contactOrder.indexOf(key);
  return at === -1 ? contactOrder.length : at;
};

export function PersonDetails({ id, person, editTo, word = "Personal detail" }: { id: string; person: Item; editTo?: string; word?: string }) {
  const { filled, item } = usePersonAttributes(id, person);
  const edit = <SectionGo permission="member.edit" act="Edit" to={editTo ?? residentPaths.personEdit.path({ id })} />;
  const name = personNameOf(person);
  const contactFirst = [...filled].sort((a, b) => contactRank(a.key) - contactRank(b.key));
  const rows = [
    ...(name ? [<ListRow key="name" title="Name" meta={name} />] : []),
    ...contactFirst.map((field) => <ListRow key={field.key} title={field.label} meta={String(item[field.key])} />),
  ];
  return <Section word={word} plain foot={edit} empty={{ words: "No details on file yet." }} rows={rows} />;
}

export function PersonHead({ person }: { person: Item }) {
  const status = typeof person.status === "string" ? person.status : "";
  return (
    <div className="title-block">
      <h1 className="person-name">{personNameOf(person)}</h1>
      {status ? <p className="quiet-line">{status}</p> : null}
    </div>
  );
}

export function PersonPanel({ person }: { person: Item; onSaved?: () => void }) {
  const id = String(person.id ?? "");
  return (
    <div className="person-page">
      <PersonHead person={person} />
      <div className="sections">
        <PersonDetails id={id} person={person} />
        <PersonGroups id={id} />
        <PersonApplications id={id} />
        <PersonRaised id={id} />
        <PersonBills id={id} />
        <PersonRecords id={id} />
        <PersonHoldings id={id} />
        <PersonActivity id={id} />
      </div>
    </div>
  );
}
