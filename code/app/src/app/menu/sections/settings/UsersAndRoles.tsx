import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { MenuWindow } from "../../MenuWindow";

type Seat = { role_name?: unknown };

const rolesOf = (standing: unknown) => {
  const seats = (standing as { seats?: Seat[] } | null)?.seats;
  return (Array.isArray(seats) ? seats : [])
    .map((seat) => seat.role_name)
    .filter((name): name is string => typeof name === "string" && name !== "")
    .join(", ");
};

const standingOf = (actorId: string) => callTool("", "actor_get_actor_standing", { actor_id: actorId });

const loadPeople = async () => {
  const people = itemsOf(await callTool("", "actor_list_actors"));
  return Promise.all(people.map(async (person) => ({ id: person.id, display_name: person.display_name, roles: rolesOf(await standingOf(person.id)) })));
};

const loadPerson = async (id: string) => {
  const standing = await standingOf(id);
  return { id, display_name: (standing as { display_name?: string } | null)?.display_name, roles: rolesOf(standing) };
};

export function UsersAndRoles() {
  return (
    <MenuWindow
      title="Users & Roles"
      list={{ title: "Users & Roles", tool: "actor_list_actors", load: loadPeople, fields: { title: "display_name", meta: "roles" }, empty: { words: "No one has joined this agency yet." } }}
      detail={{ tool: "actor_get_actor_standing", load: loadPerson, fields: { Name: "display_name", Roles: "roles" }, status: "status" }}
    />
  );
}
