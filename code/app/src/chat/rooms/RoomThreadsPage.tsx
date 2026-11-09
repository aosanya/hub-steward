import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { chatListPath, routes } from "../../routes";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { generalOf, mcpRoomsClient, type RoomThread, type RoomsClient } from "./api";
import { timeOf } from "./time";
import "./rooms.css";

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

function StartThread({ onStart }: { onStart: (label: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [problem, setProblem] = useState("");
  const start = async () => {
    setProblem("");
    try {
      await onStart(label.trim());
    } catch {
      setProblem("The thread was not started. Try again.");
    }
  };
  if (!open) return <Button onClick={() => setOpen(true)}>Start a thread</Button>;
  return (
    <Card>
      <Field label="What is the thread about?" value={label} onChange={(e) => setLabel(e.target.value)} error={problem} />
      <Button kind="primary" disabled={label.trim() === ""} onClick={start}>
        Start
      </Button>
    </Card>
  );
}

export function RoomThreadsPage({ client = mcpRoomsClient }: { client?: RoomsClient }) {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const threads = useLoad(() => client.listThreads(roomId), `threads/${roomId}`);
  const subject = useLoad(() => client.subject(), "subject");
  const me = subject.state === "ready" ? subject.data : "";
  const list = threads.state === "ready" ? threads.data : [];
  const general = generalOf(list);
  const open = (threadId: string) => navigate(routes.roomThread.path({ roomId, threadId }));
  const start = async (label: string) => open(await client.startThread(roomId, label));
  return (
    <Shell title="Threads" tabless onBack={() => navigate(general ? routes.roomThread.path({ roomId, threadId: general.id }) : chatListPath())}>
      {threads.state === "error" ? <LoadFailed words="The threads could not be loaded." /> : null}
      {threads.state === "ready" && list.length === 0 ? <EmptyCard words="No messages yet." /> : null}
      {list.length > 0 ? (
        <Rows>
          {list.map((thread) => (
            <ListRow key={thread.id} className="room" title={thread.label} meta={metaOf(thread, me)} end={endOf(thread)} onClick={() => open(thread.id)} />
          ))}
        </Rows>
      ) : null}
      {threads.state === "ready" ? <StartThread onStart={start} /> : null}
    </Shell>
  );
}
