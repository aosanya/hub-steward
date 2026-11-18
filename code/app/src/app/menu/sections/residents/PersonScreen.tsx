import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMay } from "../../../../features/agency/useMay";
import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { ChooseSheet } from "./ChooseSheet";
import { SectionAct } from "./SectionAct";
import { PersonActivity } from "./PersonActivity";
import { type PersonEditKind } from "./PersonEdit";
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
          word={word("Groups")}
          full={full}
          opens={opens}
          act={act}
          empty={{ words: `Not in any ${word("Group").toLowerCase()} yet.`, act }}
          rows={groups.map((group) => (
            <ListRow key={group.id} title={group.name} onClick={() => open(residentPaths.groups.path({ group: group.id }))} end="›" />
          ))}
        />
      ) : null}
    </>
  );
}

export function PersonDetails({ id, person }: { id: string; person: Item }) {
  const may = useMay("member.edit");
  const navigate = useNavigate();
  const { filled, item } = usePersonAttributes(id, person);
  const to = (what: PersonEditKind) => () => navigate(residentPaths.personEdit.path({ id, what }));
  const act = may ? (
    <span className="sec-acts">
      <button type="button" className="sec-act" onClick={to("name")}>Edit</button>
      <button type="button" className="sec-act" onClick={to("attributes")}>Edit attributes</button>
    </span>
  ) : undefined;
  return <Section word="Details" act={act} empty={{ words: "No details on file yet.", act }} rows={filled.map((field) => <ListRow key={field.key} title={field.label} meta={String(item[field.key])} />)} />;
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
