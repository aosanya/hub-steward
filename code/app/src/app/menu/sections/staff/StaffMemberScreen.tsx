import { useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuDetail } from "../../MenuDetail";
import { useBackToSection } from "../../useBackToSection";
import { personNameOf } from "../residents/personName";
import { listOf, roleKindNames, seatLabel, text, type Item } from "./staffData";

const loadMember = async (id: string) => {
  const found = ((await callTool("", "actor_get_actor", { actor_id: id })) as Item | null) ?? {};
  return { ...found, display_name: personNameOf(found) };
};

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
    return { id: text(seat, "id"), title: seatLabel({ ...known, ...seat, group_name: "" }, kindNames), meta: text(seat, "group_name") || text(known, "group_name"), end: ended ? endedWords(known) : "In post" };
  });
};

function Seats({ id }: { id: string }) {
  const view = useLoad(() => loadSeats(id), `staff-seats:${openAgencyId()}:${id}`);
  return (
    <>
      <SectionHeading>Seats</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words="The seats could not be loaded." /> : null}
      {view.state === "ready" && view.data.length === 0 ? <EmptyCard words="No seats yet." /> : null}
      {view.state === "ready" && view.data.length > 0 ? (
        <Rows>
          {view.data.map((seat) => (
            <ListRow key={seat.id} title={seat.title} meta={seat.meta} end={seat.end} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}

export function StaffMemberScreen() {
  const back = useBackToSection();
  const id = useParams().id ?? "";
  return (
    <Shell title="Staff member" titleUnder {...back}>
      <MenuDetail bare title="Staff member" tool="actor_get_actor" fields={{ Name: "display_name" }} status="status" id={id} load={loadMember} />
      <Seats id={id} />
    </Shell>
  );
}
