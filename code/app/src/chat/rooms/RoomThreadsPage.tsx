import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { chatListPath, routes } from "../../routes";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { Field } from "../../ui/Field";
import { Shell } from "../../ui/Shell";
import { generalOf, mcpRoomsClient, type RoomsClient } from "./api";
import { ThreadRows } from "./ThreadRows";
import "./rooms.css";

function StartThread({ onStart, bare = false }: { onStart: (label: string) => Promise<void>; bare?: boolean }) {
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
  const form = (
    <>
      <Field label="What is the thread about?" value={label} onChange={(e) => setLabel(e.target.value)} error={problem} />
      <Button kind="primary" disabled={label.trim() === ""} onClick={start}>
        Start
      </Button>
    </>
  );
  return bare ? form : <Card>{form}</Card>;
}

export function RoomThreadsPage({ client = mcpRoomsClient }: { client?: RoomsClient }) {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const threads = useLoad(() => client.listThreads(roomId), `threads/${roomId}`);
  const subject = useLoad(() => client.subject(), "subject");
  const roomName = useLoad(async () => client.roomName(roomId), `name/${roomId}`);
  const room = roomName.state === "ready" ? roomName.data : "";
  const me = subject.state === "ready" ? subject.data : "";
  const list = threads.state === "ready" ? threads.data : [];
  const general = generalOf(list);
  const open = (threadId: string) => navigate(routes.roomThread.path({ roomId, threadId }));
  const start = async (label: string) => open(await client.startThread(roomId, label));
  return (
    <Shell title="Threads" backLabel={room || "Chat"} tabless onBack={() => navigate(general ? routes.roomThread.path({ roomId, threadId: general.id }) : chatListPath())}>
      {threads.state === "error" ? <LoadFailed words="The threads could not be loaded." /> : null}
      {threads.state === "ready" && list.length === 0 ? (
        <EmptyCard words="No messages yet.">
          <StartThread bare onStart={start} />
        </EmptyCard>
      ) : null}
      {list.length > 0 ? <ThreadRows threads={list} subject={me} onOpen={open} /> : null}
      {threads.state === "ready" && list.length > 0 ? <StartThread onStart={start} /> : null}
    </Shell>
  );
}
