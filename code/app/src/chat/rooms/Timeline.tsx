import { Chip } from "../../ui/Chip";
import type { RoomMessage, RoomsClient } from "./api";
import { Attachment } from "./cards";
import { dayKey, dayLabel, timeOf } from "./time";
import "./rooms.css";

type Props = { messages: RoomMessage[]; threadLabel: string; client: RoomsClient; openAsk: (askId: string) => void };

function Bubble({ message }: { message: RoomMessage }) {
  return (
    <div className={message.mine ? "rm-msg mine" : "rm-msg"}>
      <span className="rm-who">
        <b>{message.mine ? "You" : message.author}</b>
        {message.agent ? <Chip>Agent</Chip> : null}
        <span>· {timeOf(message.at)}</span>
      </span>
      <p className="rm-bubble">{message.body}</p>
    </div>
  );
}

export function Timeline({ messages, threadLabel, client, openAsk }: Props) {
  return (
    <div className="rm-thread">
      {messages.map((message, i) => (
        <div key={message.id} className="rm-entry">
          {i === 0 || dayKey(messages[i - 1].at) !== dayKey(message.at) ? <p className="rm-day">{dayLabel(message.at)}</p> : null}
          <Bubble message={message} />
          <Attachment message={message} threadLabel={threadLabel} client={client} openAsk={openAsk} />
        </div>
      ))}
    </div>
  );
}
