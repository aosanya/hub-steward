import { useWord } from "../../features/agency/useWord";
import { useLoad } from "../../features/forms/useLoad";
import { Chip } from "../../shared/ui/Chip";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { SectionHeading } from "../../shared/ui/SectionHeading";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { listOf, paymentLine, tools, unitOf } from "./sections/finance/financeData";
import { loadBillRows } from "./sections/residents/PersonBills";

const loadPaymentRows = (rowId: string, unit: string) => async () => (await listOf(tools.paymentList, { record_row_id: rowId })).map((payment) => ({ id: String(payment.id ?? ""), meta: paymentLine(payment, unit) }));

function FeesAndBills({ rowId, unit }: { rowId: string; unit: string }) {
  const view = useLoad(loadBillRows({ record_row_id: rowId }, unit), `record-bills:${openAgencyId()}:${rowId}:${unit}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  return (
    <>
      <SectionHeading>Fees and bills</SectionHeading>
      <Rows>
        {view.data.map((bill) => (
          <ListRow key={bill.id} title={bill.meta} end={<Chip>{bill.status}</Chip>} />
        ))}
      </Rows>
    </>
  );
}

function Payments({ rowId, unit }: { rowId: string; unit: string }) {
  const view = useLoad(loadPaymentRows(rowId, unit), `record-payments:${openAgencyId()}:${rowId}:${unit}`);
  if (view.state !== "ready" || view.data.length === 0) return null;
  return (
    <>
      <SectionHeading>Payments</SectionHeading>
      <Rows>
        {view.data.map((payment) => (
          <ListRow key={payment.id} title={payment.meta} />
        ))}
      </Rows>
    </>
  );
}

export function RecordMoney({ rowId }: { rowId: string }) {
  const unit = unitOf(useWord("accounting"));
  if (!rowId) return null;
  return (
    <>
      <FeesAndBills rowId={rowId} unit={unit} />
      <Payments rowId={rowId} unit={unit} />
    </>
  );
}
