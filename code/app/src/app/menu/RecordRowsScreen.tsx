import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { liveRecordRowsTool, loadRecordRow, loadRecordRows } from "./liveRecordRows";
import { MenuWindow } from "./MenuWindow";

type Props = {
  title: string;
  recordCode: string;
  titlePrompt: string;
  metaPrompts: string[];
  prompts: string[];
  empty: { words: string; act: string; to: string };
};

export function RecordRowsScreen({ title, recordCode, titlePrompt, metaPrompts, prompts, empty }: Props) {
  const [count, setCount] = useState(0);
  const load = async () => {
    const rows = await loadRecordRows(recordCode, titlePrompt, metaPrompts);
    setCount(rows.length);
    return rows;
  };
  return (
    <MenuWindow
      key={recordCode}
      title={title}
      headEnd={count > 0 ? <Button to={empty.to}>{empty.act}</Button> : undefined}
      list={{ title, tool: liveRecordRowsTool, fields: { title: "title", meta: "meta" }, empty, load }}
      detail={{
        tool: liveRecordRowsTool,
        load: (id) => loadRecordRow(recordCode, id, prompts),
        fields: Object.fromEntries(prompts.map((prompt) => [prompt, prompt])),
        status: "status",
      }}
    />
  );
}
