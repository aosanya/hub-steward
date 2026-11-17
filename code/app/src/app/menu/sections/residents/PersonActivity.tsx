import { useWord } from "../../../../features/agency/useWord";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { dayWords } from "../../../../shared/ui/days";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { auditRowsOf } from "../settings/auditRows";

type ActivityRow = { key: string; title: string; meta: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");

const itemsOrNone = (call: Promise<unknown>) => call.then(itemsOf, () => null);

const loadAuditRows = async (personId: string) => {
  const [byPerson, aboutPerson] = await Promise.all([
    itemsOrNone(callTool("", "audit_list_entries", { actor: personId })),
    itemsOrNone(callTool("", "audit_list_entries", { subject: personId })),
  ]);
  if (byPerson === null && aboutPerson === null) return null;
  const distinct = new Map([...(byPerson ?? []), ...(aboutPerson ?? [])].map((entry) => [entry.id, entry]));
  const rows = await auditRowsOf([...distinct.values()]);
  return rows.map((row): ActivityRow => ({ key: `audit:${row.id}`, title: row.what, meta: row.who }));
};

const loadBookingRows = async (personId: string) => {
  const bookings = await itemsOrNone(callTool("", "forms_catalog_booking_list_of_person", { actor_id: personId }));
  if (bookings === null) return null;
  return bookings.map(
    (booking): ActivityRow => ({
      key: `booking:${text(booking.id)}`,
      title: text(booking.subject_id),
      meta: [dayWords(text(booking.day)), text(booking.cancelled_at) === "" ? "" : "Cancelled"].filter((part) => part !== "").join(" · "),
    }),
  );
};

const loadActivity = (personId: string) => async () => {
  const [bookingRows, auditRows] = await Promise.all([loadBookingRows(personId), loadAuditRows(personId)]);
  if (bookingRows === null && auditRows === null) throw new Error("no activity source answered");
  return [...(bookingRows ?? []), ...(auditRows ?? [])];
};

export function PersonActivity({ id }: { id: string }) {
  const word = useWord();
  const view = useLoad(loadActivity(id), `person-activity:${openAgencyId()}:${id}`);
  if (view.state === "error") return null;
  const rows = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>{word("Activity")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" && rows.length === 0 ? <EmptyCard words="No other activity yet." /> : null}
      {rows.length > 0 ? (
        <Rows>
          {rows.map((row) => (
            <ListRow key={row.key} title={row.title} meta={row.meta} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
