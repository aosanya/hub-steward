import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import type { RoomThread } from "./api";
import { timeOf } from "./time";

const whoMeta = (thread: RoomThread, subject: string) => {
  if (thread.declined) return "Declined";
  if (thread.audience !== "leads") return undefined;
  return thread.requestedBy !== "" && thread.requestedBy === subject ? "Your request · with the leaders" : "With the leaders";
};

const metaOf = (thread: RoomThread, subject: string) => [whoMeta(thread, subject), thread.preview].filter((line): line is string => !!line);

const endOf = (thread: RoomThread) => (
  <>
    {thread.lastMessageAt ? <span>{timeOf(thread.lastMessageAt)}</span> : null}
    {thread.unread > 0 ? <Chip tone="accent">{thread.unread}</Chip> : null}
  </>
);

type Props = { threads: RoomThread[]; subject: string; onOpen: (threadId: string) => void };

export function ThreadRows({ threads, subject, onOpen }: Props) {
  return (
    <Rows>
      {threads.map((thread) => (
        <ListRow key={thread.id} className="room" title={thread.label} meta={metaOf(thread, subject)} end={endOf(thread)} onClick={() => onOpen(thread.id)} />
      ))}
    </Rows>
  );
}
