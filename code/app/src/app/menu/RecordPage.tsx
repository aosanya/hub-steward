import { ListRow } from "../../shared/ui/ListRow";
import { Section } from "../../shared/ui/Section";
import { recordRowIdKey } from "./liveRecordRows";
import { RecordEditAct } from "./RecordEditAct";
import { RecordRowExtra } from "./RecordRowExtra";
import { ChatAboutRecord, type RecordChat } from "./sections/residents/ChatAboutRecord";

type Item = Record<string, unknown>;

type Props = {
  row: Item;
  recordCode: string;
  titlePrompt: string;
  prompts: string[];
  detailWord: string;
  owner?: { prompt: string; heading: string };
  licence?: boolean;
  editPath?: (id: string) => string;
  chat?: RecordChat;
};

const quietPrompts = ["Status", "Neighbourhood"];

const answerOf = (row: Item, prompt: string) => {
  const value = row[prompt];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export function RecordPage({ row, recordCode, titlePrompt, prompts, detailWord, owner, licence, editPath, chat }: Props) {
  const quiet = quietPrompts.map((prompt) => answerOf(row, prompt)).filter(Boolean).join(" · ");
  const answered = prompts.filter((prompt) => answerOf(row, prompt) !== "");
  return (
    <div className="person-page">
      {chat ? <ChatAboutRecord row={row} titlePrompt={titlePrompt} prompts={prompts} chat={chat} /> : null}
      <div className="title-block">
        <h1 className="person-name">{answerOf(row, titlePrompt)}</h1>
        {quiet ? <p className="quiet-line">{quiet}</p> : null}
      </div>
      <div className="sections">
        <Section word={detailWord} plain all foot={editPath && row[recordRowIdKey] ? <RecordEditAct recordCode={recordCode} to={editPath(String(row[recordRowIdKey]))} /> : null} rows={answered.map((prompt) => <ListRow key={prompt} title={prompt} meta={answerOf(row, prompt)} />)} />
        <RecordRowExtra row={row} recordCode={recordCode} owner={owner} licence={licence} />
      </div>
    </div>
  );
}
