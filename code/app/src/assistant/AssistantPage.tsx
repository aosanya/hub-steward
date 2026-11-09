import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { issuePath } from "../backlogs/paths";
import { Composer } from "../chat/rooms/Composer";
import "../chat/rooms/rooms.css";
import { useLoad } from "../forms/useLoad";
import { chatListPath } from "../routes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { EmptyCard } from "../ui/LoadState";
import { Markdown } from "../ui/Markdown";
import { Shell } from "../ui/Shell";
import { mcpAssistantClient, type AssistantClient } from "./api";
import { answerAfter, historyUpTo, markSent, nextQueued, withoutItem, type Item } from "./queue";
import { ListEntries, ResultsPanel, ResultTabs, useResults } from "./ResultsPanel";
import { withIds } from "./results";
import "./assistant.css";

export const assistantName = "Hub Steward";

export const unavailableWords = "The assistant is not available yet.";

export const failedWords = "That did not work. Try again.";

export const workingWords = "Looking it up";

export const retryWords = "Try again";

export const slowAfter = 60_000;

export const queuedWords = "Queued";

export const unqueueWords = "Remove from the queue";

export const askPlaceholder = "Ask about the backlogs";

type Phase = "idle" | "working" | "failed";

function Who() {
  return (
    <span className="rm-who">
      <b>{assistantName}</b>
      <Chip>Agent</Chip>
    </span>
  );
}

function Working({ step }: { step: string }) {
  return (
    <div className="rm-msg" role="status">
      <Who />
      <div className="rm-bubble">
        <span className="assistant-working">
          <span className="assistant-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {workingWords}
        </span>
        {step ? <span className="assistant-step">{step}</span> : null}
      </div>
    </div>
  );
}

function Failed({ retry }: { retry: () => void }) {
  return (
    <div className="rm-msg" role="alert">
      <Who />
      <div className="rm-bubble">
        <p>{failedWords}</p>
        <Button onClick={retry}>{retryWords}</Button>
      </div>
    </div>
  );
}

type BubblesProps = { items: Item[]; phase: Phase; current: number; step: string; retry: () => void; pick: (id: string) => void; unqueue: (id: number) => void };

function Bubbles({ items, phase, current, step, retry, pick, unqueue }: BubblesProps) {
  return (
    <div className="rm-thread">
      {items.map((item) => (
        <div key={item.id} className="rm-entry">
          {item.role === "user" ? (
            <div className="rm-msg mine">
              <span className="rm-who">
                <b>You</b>
                {item.queued ? (
                  <>
                    <span className="assistant-queued">{queuedWords}</span>
                    <button type="button" className="assistant-unqueue" aria-label={`${unqueueWords}: ${item.content}`} onClick={() => unqueue(item.id)}>
                      ×
                    </button>
                  </>
                ) : null}
              </span>
              <p className="rm-bubble">{item.content}</p>
            </div>
          ) : (
            <div className="rm-msg">
              <Who />
              <div className="rm-bubble">
                <Markdown text={item.content} />
              </div>
              {item.lists && item.lists.length > 0 ? <ListEntries lists={item.lists} onPick={pick} /> : null}
            </div>
          )}
          {item.id === current && phase === "working" ? <Working step={step} /> : null}
          {item.id === current && phase === "failed" ? <Failed retry={retry} /> : null}
        </div>
      ))}
    </div>
  );
}

export function AssistantPage({ client = mcpAssistantClient, timeoutMs = slowAfter }: { client?: AssistantClient; timeoutMs?: number }) {
  const navigate = useNavigate();
  const model = useLoad(() => client.model(), "assistant/model");
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [current, setCurrent] = useState(0);
  const [step, setStep] = useState("");
  const run = useRef(0);
  const last = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const found = useResults(items);
  const accountId = model.state === "ready" ? model.data : "";
  const unavailable = model.state === "error" || (model.state === "ready" && accountId === "");
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [items, phase, step, found.tab]);
  const answerTo = async (history: Item[], id: number) => {
    const mine = ++run.current;
    setCurrent(id);
    setPhase("working");
    setStep("");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tooSlow = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("slow")), timeoutMs);
    });
    try {
      const answer = await Promise.race([client.ask(accountId, historyUpTo(history, id), (words) => mine === run.current && setStep(words)), tooSlow]);
      if (mine !== run.current) return;
      last.current += 1;
      setItems((now) => answerAfter(now, id, { id: last.current, role: "assistant", content: answer.text, lists: withIds(answer.lists ?? [], last.current) }));
      setPhase("idle");
    } catch {
      if (mine === run.current) setPhase("failed");
    } finally {
      clearTimeout(timer);
    }
  };
  useEffect(() => {
    if (phase !== "idle" || accountId === "") return;
    const next = nextQueued(items);
    if (!next) return;
    const sent = markSent(items, next.id);
    setItems(sent);
    void answerTo(sent, next.id);
  }, [items, phase, accountId]);
  const send = async (body: string) => {
    last.current += 1;
    setItems((now) => [...now, { id: last.current, role: "user", content: body, queued: true }]);
  };
  return (
    <Shell title={assistantName} backLabel="Chat" tabless onBack={() => navigate(chatListPath())}>
      {unavailable ? <EmptyCard words={unavailableWords} /> : null}
      {!unavailable ? (
        <div className="assistant-panel">
          <ResultTabs tab={found.tab} onTab={found.setTab} unseen={found.unseen} />
          {found.tab === "results" ? (
            <ResultsPanel results={found.results} picked={found.picked} onPick={found.setPicked} onOpen={(id) => navigate(issuePath(id))} />
          ) : (
            <Card>
              {items.length === 0 ? (
                <p className="assistant-empty">{askPlaceholder}</p>
              ) : (
                <Bubbles items={items} phase={phase} current={current} step={step} retry={() => void answerTo(items, current)} pick={found.pick} unqueue={(id) => setItems((now) => withoutItem(now, id))} />
              )}
              <div ref={end} />
            </Card>
          )}
        </div>
      ) : null}
      {model.state === "ready" && !unavailable ? (
        <div className="assistant-compose">
          <Composer placeholder={askPlaceholder} onSend={send} />
        </div>
      ) : null}
    </Shell>
  );
}
