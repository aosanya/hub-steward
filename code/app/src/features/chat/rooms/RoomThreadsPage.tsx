import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../../features/forms/useLoad";
import { chatListPath, routes } from "../../../app/routes";
import { EmptyCard, LoadFailed } from "../../../shared/ui/LoadState";
import { Shell } from "../../../app/Shell";
import { useWide } from "../../../shared/ui/useWide";
import { generalOf, mcpRoomsClient, type RoomsClient } from "./api";
import { StartThread } from "./StartThread";
import { ThreadRows } from "./ThreadRows";
import "../../../shared/ui/paneWindow.css";
import "./rooms.css";

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
  const wide = useWide();
  const start = async (label: string) => open(await client.startThread(roomId, label));
  const back = () => navigate(general ? routes.roomThread.path({ roomId, threadId: general.id }) : chatListPath());
  const rows = (
    <>
      {threads.state === "error" ? <LoadFailed words="The threads could not be loaded." /> : null}
      {threads.state === "ready" && list.length === 0 ? (
        <EmptyCard words="No messages yet.">
          <StartThread bare onStart={start} />
        </EmptyCard>
      ) : null}
      {list.length > 0 ? <ThreadRows threads={list} subject={me} onOpen={open} /> : null}
      {threads.state === "ready" && list.length > 0 ? <StartThread onStart={start} /> : null}
    </>
  );
  if (wide) {
    return (
      <Shell title="Threads" backLabel={room || "Chat"} tabless onBack={back}>
        <div className="wf">
          <div className="wf-panes">
            <section className="wf-tree rm-tree" aria-label="Threads">
              {rows}
            </section>
            <section className="wf-main" />
          </div>
          <footer className="wf-status" aria-label="Status bar" />
        </div>
      </Shell>
    );
  }
  return (
    <Shell title="Threads" backLabel={room || "Chat"} tabless onBack={back}>
      {rows}
    </Shell>
  );
}
