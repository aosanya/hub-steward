import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Chip } from "../../../../shared/ui/Chip";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { EmptyCard, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { billRow, listOf, text, tools, unitOf } from "../finance/financeData";
import { useOpenBill } from "./useOpenBill";

const loadBills = (personId: string, unit: string) => async () => {
  const bills = await listOf(tools.billList, { actor_id: personId });
  return [...bills].sort((a, b) => text(b, "due_at").localeCompare(text(a, "due_at"))).map((bill) => billRow(bill, unit));
};

export function PersonBills({ id }: { id: string }) {
  const word = useWord("accounting");
  const unit = unitOf(word);
  const openBill = useOpenBill(id, useWord("actor")("Residents"));
  const view = useLoad(loadBills(id, unit), `person-bills:${openAgencyId()}:${id}:${unit}`);
  if (view.state === "error") return null;
  const bills = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>{word("Bills")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" && bills.length === 0 ? <EmptyCard words={`No ${word("Bills").toLowerCase()} yet.`} /> : null}
      {bills.length > 0 ? (
        <Rows>
          {bills.map((bill) => (
            <ListRow key={bill.id} title={bill.meta} end={<Chip>{bill.status}</Chip>} onClick={() => openBill(bill.id)} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
