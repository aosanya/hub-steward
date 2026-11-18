import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { Chip } from "../../../../shared/ui/Chip";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { billRow, listOf, text, tools, unitOf } from "../finance/financeData";
import { useOpenSection } from "./personSections";
import { useOpenBill } from "./useOpenBill";

export const loadBillRows = (filter: Record<string, string>, unit: string) => async () => {
  const bills = await listOf(tools.billList, filter);
  return [...bills].sort((a, b) => text(b, "due_at").localeCompare(text(a, "due_at"))).map((bill) => billRow(bill, unit));
};

export function PersonBills({ id, full }: { id: string; full?: boolean }) {
  const opens = useOpenSection(id, "bills");
  const word = useWord("accounting");
  const unit = unitOf(word);
  const openBill = useOpenBill(id, useWord("actor")("Residents"));
  const view = useLoad(loadBillRows({ actor_id: id }, unit), `person-bills:${openAgencyId()}:${id}:${unit}`);
  if (view.state === "error") return null;
  const bills = view.state === "ready" ? view.data : [];
  return (
    <>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" ? (
        <Section
          word={word("Bills")}
          full={full}
          opens={opens}
          empty={{ words: `No ${word("Bills").toLowerCase()} yet.` }}
          rows={bills.map((bill) => (
            <ListRow key={bill.id} title={bill.meta} end={<Chip>{bill.status}</Chip>} onClick={() => openBill(bill.id)} />
          ))}
        />
      ) : null}
    </>
  );
}
