import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { MenuWindow } from "../../MenuWindow";
import { settingsPaths } from "./paths";
import { ChatAboutItem, text, useChosenItem } from "./RecordPage";
import { PageFrame } from "../../PageFrame";
import { SeatEnd, type Seat as HeldSeat } from "./SeatEnd";
import { SeatGive } from "./SeatGive";
import { labelOf } from "./personLabel";

type Seat = { id?: unknown; role_name?: unknown };

const rolesOf = (standing: unknown) => {
  const seats = (standing as { seats?: Seat[] } | null)?.seats;
  const names = (Array.isArray(seats) ? seats : [])
    .map((seat) => seat.role_name)
    .filter((name): name is string => typeof name === "string" && name !== "");
  return [...new Set(names)].join(", ");
};

const seatsOf = (standing: unknown): HeldSeat[] => {
  const seats = (standing as { seats?: Seat[] } | null)?.seats;
  return (Array.isArray(seats) ? seats : []).flatMap((seat) =>
    typeof seat.id === "string" && typeof seat.role_name === "string" && seat.role_name !== "" ? [{ id: seat.id, role: seat.role_name }] : [],
  );
};

const standingOf = (actorId: string) => callTool("", "actor_get_actor_standing", { actor_id: actorId });

const loadPeople = async () => {
  const people = itemsOf(await callTool("", "actor_list_actors"));
  return Promise.all(people.map(async (person) => ({ id: person.id, display_name: labelOf(person), roles: rolesOf(await standingOf(person.id)) })));
};

const loadPerson = async (id: string) => {
  const standing = await standingOf(id);
  return { id, display_name: labelOf({ id, ...(standing as Record<string, unknown> | null) }), roles: rolesOf(standing), seats: seatsOf(standing) };
};

export function UsersAndRoles() {
  const word = useWord();
  const title = word("Users & Roles");
  const [version, setVersion] = useState(0);
  const ended = () => setVersion((was) => was + 1);
  return (
    <MenuWindow
      title={title}
      withTabs
      bandless
      startAt={useChosenItem()}
      listKey={version}
      detailKey={version}
      list={{ title, tool: "actor_list_actors", load: loadPeople, fields: { title: "display_name", meta: "roles" }, empty: { words: "No one has joined this agency yet." } }}
      detail={{ tool: "actor_get_actor_standing", load: loadPerson, fields: {}, status: "",
        extra: (person) => {
          const seats = (person.seats as HeldSeat[] | undefined) ?? [];
          return (
            <>
              <ChatAboutItem about={{ kind: "user", id: text(person, "id"), name: text(person, "display_name") }} back={settingsPaths.usersAndRoles.path()} />
              <PageFrame title={text(person, "display_name")} line={text(person, "roles") || "No roles yet"}>
                <Section word="Roles" empty={{ words: "No roles yet." }} rows={seats.map((seat) => <ListRow key={seat.id} title={seat.role} />)} foot={<SeatEnd seats={seats} onEnded={ended} />} />
                <Section word="Give a role" plain rows={[<SeatGive key="give" actorId={String(person.id)} onGiven={ended} />]} />
              </PageFrame>
            </>
          );
        },
      }}
    />
  );
}
