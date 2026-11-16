import { useLocation, useNavigate } from "react-router-dom";
import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { dayWords } from "../../../../shared/ui/days";
import { callTool } from "../../../../shared/wakala/mcp";
import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuList } from "../../MenuList";
import { populationFigure } from "../../populationFigure";
import { useBackToSection } from "../../useBackToSection";
import { residentPaths } from "./paths";
import { personNameOf } from "./personName";
import { PersonScreen } from "./PersonScreen";

export { PersonScreen };

type Item = Record<string, unknown>;

const householdTypes = new Set(["household", "háztartás"]);

const text = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const listOf = async (tool: string, args?: Record<string, unknown>) => itemsOf(await callTool("", tool, args)) as Item[];

const memberCountOf = async (group: Item) => {
  const count = await populationFigure(text(group, "id"));
  return { id: text(group, "id"), name: text(group, "name"), meta: count === null ? "" : `${count} members` };
};

const groupRows = async (keep: (group: Item) => boolean) => Promise.all((await listOf("actor_list_groups")).filter(keep).map(memberCountOf));

const perGroup = async (tool: string, idName: string) => {
  const groups = await listOf("actor_list_groups");
  const lists = await Promise.all(groups.map((group) => listOf(tool, { [idName]: text(group, "id") })));
  return lists.flat();
};

const homeEmpty = (words: string) => ({ words, act: "Home", to: agencyHomePath(openAgencyId()) });

type ListScreenProps = { title: string; tool: string; fields: { title: string; meta: string }; empty: string; load: () => Promise<Item[]>; onChoose?: (id: string) => void };

function ListScreen({ title, tool, fields, empty, load, onChoose }: ListScreenProps) {
  const back = useBackToSection();
  return (
    <Shell title={title} titleUnder {...back}>
      <MenuList bare title={title} tool={tool} fields={fields} empty={homeEmpty(empty)} load={load} onChoose={onChoose} />
    </Shell>
  );
}

export function AllPeopleScreen() {
  const word = useWord("actor");
  const peopleTitle = `All ${word("People")}`;
  const navigate = useNavigate();
  const here = useLocation();
  const open = (id: string) =>
    navigate(residentPaths.person.path({ id }), { state: { from: { path: `${here.pathname}${here.search}`, title: peopleTitle } } });
  const load = async () => (await listOf("actor_list_actors")).map((person) => ({ id: text(person, "id"), name: personNameOf(person), status: text(person, "status") }));
  return <ListScreen title={peopleTitle} tool="actor_list_actors" fields={{ title: "name", meta: "status" }} empty={`No ${word("People").toLowerCase()} yet.`} load={load} onChoose={open} />;
}

export function HouseholdsScreen() {
  const word = useWord("actor");
  const load = () => groupRows((group) => householdTypes.has(text(group, "node_type").toLowerCase()));
  return <ListScreen title={word("Households")} tool="actor_list_groups" fields={{ title: "name", meta: "meta" }} empty={`No ${word("Households").toLowerCase()} yet.`} load={load} />;
}

export function RegistrationsScreen() {
  const word = useWord("actor");
  const load = async () => {
    const [requests, people] = await Promise.all([perGroup("actor_list_join_requests_for_group", "group_id"), listOf("actor_list_actors")]);
    const nameById = new Map(people.map((person) => [text(person, "id"), personNameOf(person)]));
    return requests.map((request) => ({
      id: text(request, "id"),
      name: text(request, "actor_name") || nameById.get(text(request, "actor_id")) || "",
      asked: dayWords(text(request, "requested_at")),
    }));
  };
  return <ListScreen title={word("Registrations")} tool="actor_list_join_requests_for_group" fields={{ title: "name", meta: "asked" }} empty={`No ${word("Registrations").toLowerCase()} waiting.`} load={load} />;
}

export function GroupsScreen() {
  const word = useWord("actor");
  const groupsTitle = word("Groups") === "Groups" ? "Groups & Associations" : word("Groups");
  const load = () => groupRows(() => true);
  return <ListScreen title={groupsTitle} tool="actor_list_groups" fields={{ title: "name", meta: "meta" }} empty={`No ${word("Groups").toLowerCase()} yet.`} load={load} />;
}

export function CommunicationsScreen() {
  const word = useWord("comm");
  const noneYet = word("Communications") === "Communications" ? "No conversations yet." : `No ${word("Communications").toLowerCase()} yet.`;
  const load = async () =>
    (await perGroup("comm_chat_thread_list", "structure_id")).map((thread) => ({ id: text(thread, "id"), label: text(thread, "label"), last: dayWords(text(thread, "last_message_at")) }));
  return <ListScreen title={word("Communications")} tool="comm_chat_thread_list" fields={{ title: "label", meta: "last" }} empty={noneYet} load={load} />;
}
