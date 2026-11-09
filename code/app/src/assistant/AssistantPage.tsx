import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Composer } from "../chat/rooms/Composer";
import "../chat/rooms/rooms.css";
import { useLoad } from "../forms/useLoad";
import { chatListPath } from "../routes";
import { Chip } from "../ui/Chip";
import { EmptyCard } from "../ui/LoadState";
import { Markdown } from "../ui/Markdown";
import { Shell } from "../ui/Shell";
import { mcpAssistantClient, type AssistantClient, type Turn } from "./api";

export const assistantName = "Hub Steward";

export const unavailableWords = "The assistant is not available yet.";

export const failedWords = "The assistant could not answer. Try again.";

export const askPlaceholder = "Ask about the backlogs";

function Bubbles({ turns }: { turns: Turn[] }) {
  return (
    <div className="rm-thread">
      {turns.map((turn, index) =>
        turn.role === "user" ? (
          <div key={index} className="rm-msg mine">
            <span className="rm-who">
              <b>You</b>
            </span>
            <p className="rm-bubble">{turn.content}</p>
          </div>
        ) : (
          <div key={index} className="rm-msg">
            <span className="rm-who">
              <b>{assistantName}</b>
              <Chip>Agent</Chip>
            </span>
            <div className="rm-bubble">
              <Markdown text={turn.content} />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

export function AssistantPage({ client = mcpAssistantClient }: { client?: AssistantClient }) {
  const navigate = useNavigate();
  const model = useLoad(() => client.model(), "assistant/model");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const accountId = model.state === "ready" ? model.data : "";
  const unavailable = model.state === "error" || (model.state === "ready" && accountId === "");
  const send = async (body: string) => {
    const asked: Turn[] = [...turns, { role: "user", content: body }];
    setTurns(asked);
    setBusy(true);
    try {
      const answer = await client.ask(accountId, asked);
      setTurns([...asked, { role: "assistant", content: answer }]);
    } catch {
      setTurns([...asked, { role: "assistant", content: failedWords }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title={assistantName} backLabel="Chat" tabless onBack={() => navigate(chatListPath())}>
      {unavailable ? <EmptyCard words={unavailableWords} /> : null}
      {!unavailable ? <Bubbles turns={turns} /> : null}
      {busy ? (
        <p className="rm-note" role="status">
          Looking it up
        </p>
      ) : null}
      {model.state === "ready" && !unavailable ? <Composer placeholder={askPlaceholder} onSend={send} /> : null}
    </Shell>
  );
}
