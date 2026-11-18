import { useState } from "react";
import { Composer } from "../../../../features/chat/rooms/Composer";
import { mcpRoomsClient } from "../../../../features/chat/rooms/api";
import { dayLabel, timeOf } from "../../../../features/chat/rooms/time";
import "../../../../features/chat/rooms/rooms.css";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { Sheet } from "../../../../shared/ui/Sheet";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { SectionAct } from "./SectionAct";

type Row = Record<string, unknown>;

const textOf = (row: Row, key: string) => (typeof row[key] === "string" ? (row[key] as string) : "");

const writeTitle = "Write to the group";

export function GroupConversation({ row }: { row: Row }) {
  const roomId = textOf(row, "group_id");
  const threadId = textOf(row, "id");
  const [version, setVersion] = useState(0);
  const view = useLoad(() => mcpRoomsClient.listMessages(roomId, threadId), `group-conversation:${openAgencyId()}:${threadId}:${version}`);
  if (roomId === "" || threadId === "") return null;
  const messages = view.state === "ready" ? [...view.data].reverse() : [];
  const write = (
    <SectionAct
      permission="chat.post"
      act={writeTitle}
      sheet={(close) => (
        <Sheet title={writeTitle} onClose={close}>
          <Composer
            placeholder={writeTitle}
            focusOnArrival
            onSend={async (body) => {
              await mcpRoomsClient.post(roomId, threadId, body);
              close();
              setVersion((was) => was + 1);
            }}
          />
        </Sheet>
      )}
    />
  );
  const label = textOf(row, "line");
  const last = textOf(row, "last");
  return (
    <div className="person-page">
      <div className="title-block">
        <h1 className="person-name">{textOf(row, "name")}</h1>
        <p className="quiet-line">
          {label ? <span>{label}</span> : null}
          {last ? <span>{label ? " · " : ""}last message {last}</span> : null}
        </p>
      </div>
      <div className="sections">
        {view.state === "loading" ? <LoadingLine /> : null}
        {view.state === "error" ? <LoadFailed words="The conversation could not be loaded." /> : null}
        {view.state === "ready" ? (
          <Section
            word="Conversation"
            all
            foot={write}
            empty={{ words: "No messages yet." }}
            rows={messages.map((message) => (
              <ListRow key={message.id} title={message.mine ? "You" : message.author} meta={[message.body, `${dayLabel(message.at)}, ${timeOf(message.at)}`]} />
            ))}
          />
        ) : null}
      </div>
    </div>
  );
}
