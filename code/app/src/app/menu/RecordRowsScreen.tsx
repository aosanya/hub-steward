import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { liveRecordRowsTool, loadRecordRow, loadRecordRows } from "./liveRecordRows";
import { MenuWindow } from "./MenuWindow";
import { RecordPage } from "./RecordPage";
import { loadLicenceMarks, type LicenceMark } from "./sections/residents/licensedRows";
import { LicenceChip } from "./sections/residents/LicenceChip";
import type { RecordChat } from "./sections/residents/ChatAboutRecord";

type Props = {
  title: string;
  recordCode: string;
  titlePrompt: string;
  detailWord: string;
  metaPrompts: string[];
  prompts: string[];
  assetPrompts?: string[];
  empty: { words: string; act: string; to: string };
  owner?: { prompt: string; heading: string };
  licence?: boolean;
  editPath?: (id: string) => string;
  chat?: RecordChat;
};

const licenceMarkKey = "licenceMark";

const licenceChip = (item: Record<string, unknown>) => (typeof item[licenceMarkKey] === "string" ? <LicenceChip mark={item[licenceMarkKey] as LicenceMark} /> : null);

export function RecordRowsScreen({ title, recordCode, titlePrompt, detailWord, metaPrompts, prompts, assetPrompts, empty, owner, licence, editPath, chat }: Props) {
  const [search] = useSearchParams();
  const [count, setCount] = useState(0);
  const load = async () => {
    const [rows, marks] = await Promise.all([
      loadRecordRows(recordCode, titlePrompt, metaPrompts, assetPrompts),
      licence ? loadLicenceMarks(recordCode) : Promise.resolve(null),
    ]);
    setCount(rows.length);
    return marks ? rows.map((row) => ({ ...row, [licenceMarkKey]: marks.get(row.id) ?? "Not licensed" })) : rows;
  };
  return (
    <MenuWindow
      key={recordCode}
      title={title}
      withTabs
      bandless
      startAt={search.get("row") ?? undefined}
      headEnd={count > 0 ? <Button to={empty.to}>{empty.act}</Button> : undefined}
      list={{ title, tool: liveRecordRowsTool, fields: { title: "title", meta: "meta" }, empty, load, end: licence ? licenceChip : undefined }}
      detail={{
        tool: liveRecordRowsTool,
        load: (id) => loadRecordRow(recordCode, id, prompts, owner?.prompt, assetPrompts),
        fields: {},
        status: "",
        extra: (row) => <RecordPage row={row} recordCode={recordCode} titlePrompt={titlePrompt} prompts={prompts} detailWord={detailWord} owner={owner} licence={licence} editPath={editPath} chat={chat} />,
      }}
    />
  );
}
