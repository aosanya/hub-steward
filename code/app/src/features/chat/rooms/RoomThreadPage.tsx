import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../../../shared/language/language";
import { useLoad } from "../../../features/forms/useLoad";
import { chatListPath, routes } from "../../../app/routes";
import { Card } from "../../../shared/ui/Card";
import { Chip } from "../../../shared/ui/Chip";
import { LoadFailed } from "../../../shared/ui/LoadState";
import { Shell } from "../../../app/Shell";
import { generalOf, mcpRoomsClient, type RoomMessage, type RoomsClient } from "./api";
import { BacklogSummariesLoader } from "../../backlogs";
import { askPath } from "./cards";
import { Composer } from "./Composer";
import { questionWords, StartThread } from "./StartThread";
import { ThreadRows } from "./ThreadRows";
import { QuestionRoomSwitch } from "./QuestionRoomSwitch";
import { Timeline } from "./Timeline";
import "./rooms.css";

type Heading = "room" | "thread";

type Props = { client?: RoomsClient; heading?: Heading };

function useMessages(client: RoomsClient, roomId: string, threadId: string) {
  const [messages, setMessages] = useState<RoomMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    client.listMessages(roomId, threadId).then(
      (found) => live && (setMessages(found), setFailed(false)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [roomId, threadId, round]);
  return { messages, failed, reload: () => setRound((n) => n + 1) };
}

export function RoomThreadPage({ client = mcpRoomsClient, heading = "room" }: Props) {
  const { roomId = "", threadId = "" } = useParams();
  const navigate = useNavigate();
  const { words } = useLanguage();
  const { messages, failed, reload } = useMessages(client, roomId, threadId);
  const threads = useLoad(() => client.listThreads(roomId), `threads/${roomId}`);
  const roomName = useLoad(() => client.roomName(roomId), `name/${roomId}`);
  const subject = useLoad(async () => client.subject(), "subject");
  const list = threads.state === "ready" ? threads.data : [];
  const thread = list.find((t) => t.id === threadId);
  const room = roomName.state === "ready" ? roomName.data : "";
  const label = thread?.label ?? "";
  const leader = list.some((t) => t.leader);
  const ownQuestion = thread?.audience === "leads" && thread.questionRoom && !leader;
  const memberAsking = !leader && list.some((t) => t.questionRoom);
  const roomFirst = !ownQuestion && (heading === "room" || (thread !== undefined && thread === generalOf(list)));
  const title = roomFirst ? room : label;
  const sub = roomFirst ? label : room;
  const me = subject.state === "ready" ? subject.data : "";
  const openAsk = thread?.audience === "group" && thread.questionRoom;
  const [switched, setSwitched] = useState<boolean | null>(null);
  const takesQuestions = switched ?? list.some((t) => t.takesQuestions);
  const setTakesQuestions = (on: boolean) => setSwitched(on);
  const send = async (body: string) => {
    await client.post(roomId, threadId, body);
    reload();
  };
  return (
    <Shell title={title || "Chat"} backLabel="Chat" tabless onBack={() => navigate(chatListPath())}>
      {sub ? (
        <div>
          <Chip>{sub}</Chip>
        </div>
      ) : null}
      {threads.state === "ready" && list.length > 0 ? (
        <Card title={`Threads · ${list.length}`} collapsible flush>
          <ThreadRows threads={list} subject={me} onOpen={(id) => navigate(routes.roomThread.path({ roomId, threadId: id }))} />
          {memberAsking && openAsk ? null : (
            <div className="rm-start">
              <StartThread
                bare
                words={memberAsking ? questionWords : undefined}
                onStart={async (label) => navigate(routes.roomThread.path({ roomId, threadId: await client.startThread(roomId, label) }))}
              />
            </div>
          )}
        </Card>
      ) : null}
      {thread?.audience === "leads" ? <p className="rm-note">{thread.questionRoom ? "Only you and the room's leaders read this question." : "Leaders only · members cannot see this yet"}</p> : null}
      {leader ? <QuestionRoomSwitch on={takesQuestions} onChange={async (on) => { await client.setQuestionRoom(roomId, on); setTakesQuestions(on); }} /> : null}
      {failed ? <LoadFailed words="The room could not be loaded." /> : null}
      {messages ? (
        <BacklogSummariesLoader kinds={messages.map((m) => m.kind)}>
          <Timeline messages={messages} threadLabel={label} client={client} openAsk={(askId) => navigate(askPath(roomId, threadId, askId))} />
        </BacklogSummariesLoader>
      ) : null}
      {openAsk ? (
        <div className="rm-start">
          <p className="rm-note">This room takes questions. Only you and the room's leaders read yours.</p>
          <StartThread bare words={questionWords} onStart={async (subject) => navigate(routes.roomThread.path({ roomId, threadId: await client.startThread(roomId, subject) }))} />
        </div>
      ) : thread?.declined ? (
        <p className="rm-note">This request was declined. You can read it, not write in it.</p>
      ) : (
        <Composer placeholder={ownQuestion ? words.writeYourQuestion : `Write to ${room || "the room"}`} onSend={send} />
      )}
    </Shell>
  );
}
