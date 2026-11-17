import { MenuList } from "./MenuList";
import { liveRecordRowsTool, loadRecordRows } from "./liveRecordRows";

type Props = {
  title: string;
  recordCode: string;
  titlePrompt: string;
  metaPrompts: string[];
  empty: { words: string; act: string; to: string };
};

export function RecordRowsScreen({ title, recordCode, titlePrompt, metaPrompts, empty }: Props) {
  return (
    <MenuList
      key={recordCode}
      title={title}
      tool={liveRecordRowsTool}
      fields={{ title: "title", meta: "meta" }}
      empty={empty}
      add={{ label: empty.act, to: empty.to }}
      load={() => loadRecordRows(recordCode, titlePrompt, metaPrompts)}
    />
  );
}
