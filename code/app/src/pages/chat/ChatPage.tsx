import { useNavigate } from "react-router-dom";
import { joinGroupWorkflow } from "../../home/workflowScreens";
import { unreadLabel } from "../../chat/unread";
import "../../chat/unread.css";
import { mcpChatClient, type ChatClient, type Room } from "../../chat/api";
import { stampOf } from "../../chat/stamp";
import { useLoad } from "../../forms/useLoad";
import { Button } from "../../ui/Button";
import { EmptyCard, LoadFailed } from "../../ui/LoadState";
import { ListRow, Rows } from "../../ui/ListRow";
import { routes } from "../../routes";
import { Shell } from "../../ui/Shell";

export function ChatPage({ client = mcpChatClient }: { client?: ChatClient }) {
  const navigate = useNavigate();
  const rooms = useLoad(() => client.listRooms(), "rooms");
  return (
    <Shell title="Chat" action={<Button onClick={() => navigate(routes.join.path())}>{joinGroupWorkflow}</Button>}>
      {rooms.state === "error" ? <LoadFailed words="Chat could not be loaded." /> : null}
      {rooms.state === "ready" && rooms.data.length === 0 ? <EmptyCard words="No rooms yet." /> : null}
      {rooms.state === "ready" && rooms.data.length > 0 ? (
        <Rows>
          {rooms.data.map((room) => (
            <ListRow
              key={`${room.id}-${room.threadId}`}
              title={room.name}
              lead
              className="room"
              meta={room.preview || room.threadName}
              end={<RoomEnd room={room} />}
              onClick={() => navigate(routes.roomThread.path({ roomId: room.id, threadId: room.threadId }))}
            />
          ))}
        </Rows>
      ) : null}
    </Shell>
  );
}

function RoomEnd({ room }: { room: Room }) {
  const label = unreadLabel(room.unread);
  const stamp = stampOf(room.lastAt);
  return (
    <>
      {stamp ? <span>{stamp}</span> : null}
      {label ? <span className="unread-num" aria-label={`${label} unread`}>{label}</span> : stamp ? null : <span aria-hidden="true">›</span>}
    </>
  );
}
