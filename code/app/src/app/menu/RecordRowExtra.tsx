import { recordOwnerKey, recordRowIdKey } from "./liveRecordRows";
import { RecordMoney } from "./RecordMoney";
import { RecordOwner } from "./RecordOwner";
import { RowHoldings } from "./sections/residents/PersonHoldings";
import { RowActivity } from "./sections/residents/RowActivity";

type Props = { row: Record<string, unknown>; recordCode: string; owner?: { prompt: string; heading: string } };

export function RecordRowExtra({ row, recordCode, owner }: Props) {
  const rowId = String(row[recordRowIdKey] ?? "");
  return (
    <>
      {owner ? <RecordOwner heading={owner.heading} ownerId={String(row[recordOwnerKey] ?? "")} /> : null}
      <RecordMoney rowId={rowId} />
      {rowId ? <RowHoldings rowId={rowId} /> : null}
      {rowId ? <RowActivity recordCode={recordCode} rowId={rowId} /> : null}
    </>
  );
}
