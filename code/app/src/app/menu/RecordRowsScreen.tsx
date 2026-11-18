import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { Chip } from "../../shared/ui/Chip";
import { liveRecordRowsTool, loadRecordRow, loadRecordRows, recordOwnerKey, recordRowIdKey } from "./liveRecordRows";
import { MenuWindow } from "./MenuWindow";
import { RecordMoney } from "./RecordMoney";
import { RecordOwner } from "./RecordOwner";
import { RowHoldings } from "./sections/residents/PersonHoldings";
import { loadLicensedRowIds } from "./sections/residents/licensedRows";
import { RowActivity } from "./sections/residents/RowActivity";

type Props = {
  title: string;
  recordCode: string;
  titlePrompt: string;
  metaPrompts: string[];
  prompts: string[];
  empty: { words: string; act: string; to: string };
  owner?: { prompt: string; heading: string };
  licence?: boolean;
};

const licensedKey = "licensed";
const licensedWords = "Licensed";
const notLicensedWords = "Not licensed";

const licenceChip = (item: Record<string, unknown>) =>
  item[licensedKey] === undefined ? null : item[licensedKey] ? <Chip tone="success">{licensedWords}</Chip> : <Chip>{notLicensedWords}</Chip>;

export function RecordRowsScreen({ title, recordCode, titlePrompt, metaPrompts, prompts, empty, owner, licence }: Props) {
  const [count, setCount] = useState(0);
  const load = async () => {
    const [rows, licensed] = await Promise.all([
      loadRecordRows(recordCode, titlePrompt, metaPrompts),
      licence ? loadLicensedRowIds(recordCode) : Promise.resolve(null),
    ]);
    setCount(rows.length);
    return licensed ? rows.map((row) => ({ ...row, [licensedKey]: licensed.has(row.id) })) : rows;
  };
  return (
    <MenuWindow
      key={recordCode}
      title={title}
      headEnd={count > 0 ? <Button to={empty.to}>{empty.act}</Button> : undefined}
      list={{ title, tool: liveRecordRowsTool, fields: { title: "title", meta: "meta" }, empty, load, end: licence ? licenceChip : undefined }}
      detail={{
        tool: liveRecordRowsTool,
        load: (id) => loadRecordRow(recordCode, id, prompts, owner?.prompt),
        fields: Object.fromEntries(prompts.map((prompt) => [prompt, prompt])),
        status: "status",
        extra: (row) => (
          <>
            {owner ? <RecordOwner heading={owner.heading} ownerId={String(row[recordOwnerKey] ?? "")} /> : null}
            <RecordMoney rowId={String(row[recordRowIdKey] ?? "")} />
            {row[recordRowIdKey] ? <RowHoldings rowId={String(row[recordRowIdKey])} /> : null}
            {row[recordRowIdKey] ? <RowActivity recordCode={recordCode} rowId={String(row[recordRowIdKey])} /> : null}
          </>
        ),
      }}
    />
  );
}
