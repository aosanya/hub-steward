import { useState } from "react";
import { callTool } from "../../../../shared/wakala/mcp";
import { useWord } from "../../../../features/agency/useWord";
import { MenuWindow } from "../../MenuWindow";
import { PersonEdit } from "../residents/PersonEdit";
import { personNameOf } from "../residents/personName";
import { StaffSeats } from "./StaffSeats";
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
  return { id, name: personNameOf(person ?? {}), display_name: personNameOf(person ?? {}), attributes: person?.attributes, role: seatsLine(seats, kindNames) };
};

export function StaffScreen() {
  const word = useWord("actor");
  const [version, setVersion] = useState(0);
  return (
    <MenuWindow
      title={word("Staff")}
      listKey={version}
      detailKey={version}
      list={{ title: word("Staff"), tool: "actor_list_actors", load: loadStaff, fields: { title: "name", meta: "meta" }, empty: homeEmpty(`No ${word("Staff").toLowerCase()} yet.`) }}
      detail={{
        tool: "actor_get_actor",
        load: loadPerson,
        fields: { Name: "name", Role: "role" },
        status: "status",
        extra: (person) => (
          <>
            <PersonEdit id={text(person, "id")} person={person} onSaved={() => setVersion((was) => was + 1)} />
            <StaffSeats id={text(person, "id")} />
          </>
        ),
      }}
    />
  );
}
