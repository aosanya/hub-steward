import { useSearchParams } from "react-router-dom";
import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { PersonDetails, PersonHead } from "../residents/PersonScreen";
import { personNameOf } from "../residents/personName";
import { StaffSeats } from "./StaffSeats";
import { staffPaths } from "./paths";
import { homeEmpty, listOf, roleKindNames, seatsLine, text, type Item } from "./staffData";

const seatsOfGroups = async (groups: Item[]) => {
  const perGroup = await Promise.all(groups.map((group) => listOf("actor_list_role_assignments_for_group", { group_id: text(group, "id") })));
  return perGroup.flat();
};

const loadStaff = async () => {
  const [people, groups, kindNames] = await Promise.all([listOf("actor_list_actors"), listOf("actor_list_groups"), roleKindNames()]);
  const seats = await seatsOfGroups(groups);
  return people.map((person) => ({
    id: text(person, "id"),
    name: personNameOf(person),
    meta: seatsLine(
      seats.filter((seat) => text(seat, "actor_id") === text(person, "id")),
      kindNames,
    ),
  }));
};

const loadPerson = async (id: string) => {
  const [person, seats, kindNames] = await Promise.all([
    callTool("", "actor_get_actor", { actor_id: id }) as Promise<Item | null>,
    listOf("actor_list_role_assignments_for_actor", { actor_id: id }),
    roleKindNames(),
  ]);
  const role = seatsLine(seats, kindNames);
  const state = text(person, "status");
  return { id, name: personNameOf(person ?? {}), display_name: personNameOf(person ?? {}), attributes: person?.attributes, role, status: [role, state].filter(Boolean).join(" · ") };
};

export function StaffScreen() {
  const word = useWord("actor");
  const [search] = useSearchParams();
  return (
    <MenuWindow
      title={word("Staff")}
      withTabs
      bandless
      startAt={search.get("person") ?? undefined}
      list={{ title: word("Staff"), tool: "actor_list_actors", load: loadStaff, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Staff").toLowerCase()} yet.`) }}
      detail={{
        tool: "actor_get_actor",
        load: loadPerson,
        fields: {},
        status: "",
        extra: (person) => (
          <div className="person-page">
            <PersonHead person={person} />
            <div className="sections">
              <PersonDetails id={text(person, "id")} person={person} word="Staff detail" editTo={staffPaths.personEdit.path({ id: text(person, "id") })} />
              <StaffSeats id={text(person, "id")} />
            </div>
          </div>
        ),
      }}
    />
  );
}
