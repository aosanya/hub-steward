import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMay } from "../../../../features/agency/useMay";
import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { Button } from "../../../../shared/ui/Button";
import { Chip } from "../../../../shared/ui/Chip";
import { dayWords } from "../../../../shared/ui/days";
import { callTool } from "../../../../shared/wakala/mcp";
import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { routes } from "../../../routes";
import { MenuWindow } from "../../MenuWindow";
import { populationFigure } from "../../populationFigure";
import { ChatAboutRegistration } from "./ChatAboutRegistration";
import { ChatAboutResident } from "./ChatAboutResident";
import { GroupPanel, loadGroup } from "./GroupScreen";
import { personNameOf } from "./personName";
import { RegistrationRequest } from "./RegistrationRequest";
import { loadPerson, PersonPanel } from "./PersonScreen";

type Item = Record<string, unknown>;

const householdTypes = new Set(["household", "háztartás"]);

export const text = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export const listOf = async (tool: string, args?: Record<string, unknown>) => itemsOf(await callTool("", tool, args)) as Item[];

const memberCountOf = async (group: Item) => {
  const count = await populationFigure(text(group, "id"));
  return { id: text(group, "id"), name: text(group, "name"), meta: count === null ? "" : `${count} members` };
};

const groupRows = async (keep: (group: Item) => boolean) => Promise.all((await listOf("actor_list_groups")).filter(keep).map(memberCountOf));

const perGroup = async (tool: string, idName: string) => {
  const groups = await listOf("actor_list_groups");
  const lists = await Promise.all(groups.map(async (group) => (await listOf(tool, { [idName]: text(group, "id") })).map((item) => ({ ...item, group_id: text(group, "id") }))));
  return lists.flat();
};

export const registrationRows = async () => {
  const groups = await listOf("actor_list_groups");
  const [lists, people] = await Promise.all([
    Promise.all(
      groups.map(async (group) =>
        (await listOf("actor_list_join_requests_for_group", { group_id: text(group, "id") })).map((request) => ({ ...request, group_id: text(group, "id"), group_name: text(group, "name") })),
      ),
    ),
    listOf("actor_list_actors"),
  ]);
  const nameById = new Map(people.map((person) => [text(person, "id"), personNameOf(person)]));
  return lists
    .flat()
    .filter((request) => ["", "pending"].includes(text(request, "state")))
    .map((request) => ({
      id: text(request, "id"),
      name: text(request, "actor_name") || nameById.get(text(request, "actor_id")) || "",
      asked: dayWords(text(request, "requested_at")),
      group_id: text(request, "group_id"),
      group_name: text(request, "group_name"),
      actor_id: text(request, "actor_id"),
    }));
};

export const conversationRows = async () =>
  (await perGroup("comm_chat_thread_list", "structure_id")).map((thread) => ({
    id: text(thread, "id"),
    label: text(thread, "label"),
    last: dayWords(text(thread, "last_message_at")),
    group_id: text(thread, "group_id"),
  }));

export const homeEmpty = (words: string) => ({ words, act: "Home", to: agencyHomePath(openAgencyId()) });

export const peopleRows = async () => (await listOf("actor_list_actors")).map((person) => ({ id: text(person, "id"), name: personNameOf(person), status: text(person, "status") }));

export function AllPeopleScreen() {
  const word = useWord("actor");
  const peopleTitle = `All ${word("People")}`;
  const [version, setVersion] = useState(0);
  const [search] = useSearchParams();
  const mayAdd = useMay("member.add");
  return (
    <MenuWindow
      title={peopleTitle}
      withTabs
      bandless
      headEnd={mayAdd ? <Button to={routes.personNew.path()}>Add person</Button> : undefined}
      startAt={search.get("person") ?? undefined}
      listKey={version}
      detailKey={version}
      list={{ title: peopleTitle, tool: "actor_list_actors", fields: { title: "name", meta: "status" }, empty: homeEmpty(`No ${word("People").toLowerCase()} yet.`), load: peopleRows }}
      detail={{
        tool: "actor_get_actor",
        load: loadPerson,
        fields: {},
        status: "",
        extra: (person) => (
          <>
            <ChatAboutResident person={person} />
            <PersonPanel person={person} onSaved={() => setVersion((was) => was + 1)} />
          </>
        ),
      }}
    />
  );
}

type GroupWindowProps = { title: string; empty: string; keep: (group: Item) => boolean; startAt?: string };

function GroupWindow({ title, empty, keep, startAt }: GroupWindowProps) {
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      title={title}
      startAt={startAt}
      listKey={version}
      detailKey={version}
      list={{ title, tool: "actor_list_groups", fields: { title: "name", meta: "meta" }, empty: homeEmpty(empty), load: () => groupRows(keep) }}
      detail={{
        tool: "actor_get_group",
        load: loadGroup,
        fields: { Name: "name", Joining: "join_mode", Members: "members", Hidden: "hiddenWords" },
        status: "status",
        extra: (group) => <GroupPanel group={group} onSaved={() => setVersion((was) => was + 1)} />,
      }}
    />
  );
}

export function HouseholdsScreen() {
  const word = useWord("actor");
  return <GroupWindow title={word("Households")} empty={`No ${word("Households").toLowerCase()} yet.`} keep={(group) => householdTypes.has(text(group, "node_type").toLowerCase())} />;
}

const rowById = <Row extends { id: string }>(rows: () => Promise<Row[]>) => async (id: string) => (await rows()).find((row) => row.id === id) ?? ({} as Partial<Row>);

const registrationDetail = async (id: string) => {
  const request = await rowById(registrationRows)(id);
  return { ...(await loadPerson(request.actor_id ?? "")), request_id: request.id ?? "", group_name: request.group_name ?? "", asked: request.asked ?? "" };
};

export function RegistrationsScreen() {
  const word = useWord("actor");
  const title = word("Registrations");
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      key={version}
      title={title}
      withTabs
      bandless
      list={{
        title,
        tool: "actor_list_join_requests_for_group",
        fields: { title: "name", meta: "group_name" },
        empty: homeEmpty(`No ${title.toLowerCase()} waiting.`),
        load: registrationRows,
        end: (request) => <Chip>{text(request, "asked")}</Chip>,
      }}
      detail={{
        tool: "actor_get_actor",
        load: registrationDetail,
        fields: {},
        status: "",
        extra: (person) => (
          <>
            <ChatAboutRegistration person={person} />
            <RegistrationRequest request={person} onAnswered={() => setVersion((was) => was + 1)} />
            <PersonPanel person={person} />
          </>
        ),
      }}
    />
  );
}

export function GroupsScreen() {
  const word = useWord("actor");
  const groupsTitle = word("Groups") === "Groups" ? "Groups & Associations" : word("Groups");
  const [search] = useSearchParams();
  return <GroupWindow title={groupsTitle} empty={`No ${word("Groups").toLowerCase()} yet.`} keep={() => true} startAt={search.get("group") ?? undefined} />;
}

export function CommunicationsScreen() {
  const word = useWord("comm");
  const title = word("Communications");
  const noneYet = title === "Communications" ? "No conversations yet." : `No ${title.toLowerCase()} yet.`;
  return (
    <MenuWindow
      title={title}
      list={{ title, tool: "comm_chat_thread_list", fields: { title: "label", meta: "last" }, empty: homeEmpty(noneYet), load: conversationRows }}
      detail={{ tool: "comm_chat_thread_list", load: rowById(conversationRows), fields: { Name: "label", "Last message": "last" }, status: "" }}
    />
  );
}
