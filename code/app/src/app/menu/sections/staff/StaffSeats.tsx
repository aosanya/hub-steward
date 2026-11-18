import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { listOf, roleKindNames, seatLabel, text, type Item } from "./staffData";

const endedWords = (standing: Item | undefined) => {
  const reason = text(standing, "ended_reason");
  return reason ? `Ended · ${reason}` : "Ended";
};

const loadSeats = async (id: string) => {
  const [seats, standing, kindNames] = await Promise.all([
    listOf("actor_list_role_assignments_for_actor", { actor_id: id }),
    callTool("", "actor_get_actor_standing", { actor_id: id }) as Promise<Item | null>,
    roleKindNames(),
  ]);
  const standingSeats = ((standing?.seats as Item[] | undefined) ?? []).filter((seat) => typeof seat === "object");
  return seats.map((seat) => {
    const known = standingSeats.find((candidate) => text(candidate, "id") === text(seat, "id"));
    const ended = seat.active === false || text(seat, "ended_at") !== "" || text(known, "ended_at") !== "";
    return { id: text(seat, "id"), title: seatLabel({ ...known, ...seat, group_name: "" }, kindNames), meta: text(seat, "group_name") || text(known, "group_name"), status: ended ? endedWords(known) : "In post" };
  });
};

export function StaffSeats({ id }: { id: string }) {
  const word = useWord("actor");
  const view = useLoad(() => loadSeats(id), `staff-seats:${openAgencyId()}:${id}`);
  if (view.state === "loading") return <LoadingLine />;
  if (view.state === "error") return <LoadFailed words="The seats could not be loaded." />;
  return (
    <Section
      word={word("Seats")}
      icon="briefcase"
      empty={{ words: `No ${word("Seats").toLowerCase()} yet.` }}
      rows={view.data.map((seat) => (
        <ListRow key={seat.id} title={seat.title} meta={seat.meta} status={seat.status} />
      ))}
    />
  );
}
