import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Composer } from "../chat/rooms/Composer";
import "../chat/rooms/rooms.css";
import { useLoad } from "../forms/useLoad";
import { mcpBacklogsClient, type BacklogsClient } from "../backlogs/api";
import { BacklogViewCard } from "../chat/backlogCards/BacklogViewCard";
import { BacklogSummariesLoader } from "../chat/backlogCards/SummariesLoader";
import { backlogViewKind } from "../chat/backlogCards/views";
import { chatListPath } from "../routes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { EmptyCard } from "../ui/LoadState";
import { Markdown } from "../ui/Markdown";
import { Shell } from "../ui/Shell";
import { LimitReached, mcpAssistantClient, type AssistantClient, type LimitSpan } from "./api";
import { ConfirmCard, useConfirmation } from "./ConfirmCard";
import { OptionButtons } from "./OptionButtons";
import { splitOptions } from "./optionLines";
import { answerAfter, historyUpTo, markSent, nextQueued, requeueUnanswered, withoutItem, type Item } from "./queue";
import { ListEntries, ResultsPanel, ResultTabs, useResults } from "./ResultsPanel";
import { questionOptions, viewsOf, withIds } from "./results";
import { keepConversation, keptConversation } from "./session";
import "./assistant.css";

export const assistantName = "Hub Steward";

export const unavailableWords = "The assistant is not available yet.";

export const dayLimitWords = "You have used today's share of the assistant. It comes back tomorrow.";

export const monthLimitWords = "You have used this month's share of the assistant. It comes back on the 1st.";

const limitWords: Record<LimitSpan, string> = { day: dayLimitWords, month: monthLimitWords };

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

const optionsOf = (item: Item) => {
  const written = splitOptions(item.content).options;
  return written.length > 0 ? written : questionOptions(item.content, item.lists ?? []);
};

type BubblesProps = { items: Item[]; phase: Phase; current: number; step: string; retry: () => void; pick: (id: string) => void; unqueue: (id: number) => void; ask: (words: string) => void };

function Bubbles({ items, phase, current, step, retry, pick, unqueue, ask }: BubblesProps) {
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
                <Markdown text={splitOptions(item.content).text} />
              </div>
              {(item.views ?? []).map((view) => (
                <BacklogViewCard key={view} targetId={view} />
              ))}
              {item === items[items.length - 1] && optionsOf(item).length > 0 ? <OptionButtons options={optionsOf(item)} onPick={ask} /> : null}
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

export function AssistantPage({ client = mcpAssistantClient, timeoutMs = slowAfter, backlogs = mcpBacklogsClient }: { client?: AssistantClient; timeoutMs?: number; backlogs?: BacklogsClient }) {
  const navigate = useNavigate();
  const model = useLoad(() => client.model(), "assistant/model");
  const [items, setItems] = useState<Item[]>(() => requeueUnanswered(keptConversation().items));
  const [phase, setPhase] = useState<Phase>("idle");
  const [current, setCurrent] = useState(0);
  const [step, setStep] = useState("");
  const [limit, setLimit] = useState<LimitSpan | "">("");
  const confirmation = useConfirmation();
  const run = useRef(0);
  const last = useRef(keptConversation().last);
  const end = useRef<HTMLDivElement>(null);
  const found = useResults(items);
  useEffect(() => keepConversation({ items, last: last.current }), [items]);
  const accountId = model.state === "ready" ? model.data : "";
  const unavailable = model.state === "error" || (model.state === "ready" && accountId === "");
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [items, phase, step, found.tab, confirmation.pending]);
  const answerTo = async (history: Item[], id: number) => {
    const mine = ++run.current;
    setCurrent(id);
    setPhase("working");
    setStep("");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let giveUp: () => void = () => undefined;
    const tooSlow = new Promise<never>((_, reject) => {
      giveUp = () => reject(new Error("slow"));
    });
    const startTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(giveUp, timeoutMs);
    };
    startTimer();
    const confirmWrite: typeof confirmation.confirm = async (write) => {
      clearTimeout(timer);
      const confirmed = await confirmation.confirm(write);
      startTimer();
      return confirmed;
    };
    try {
      const answer = await Promise.race([client.ask(accountId, historyUpTo(history, id), (words) => mine === run.current && setStep(words), confirmWrite), tooSlow]);
      if (mine !== run.current) return;
      last.current += 1;
      setItems((now) => answerAfter(now, id, { id: last.current, role: "assistant", content: answer.text, lists: withIds(answer.lists ?? [], last.current), views: viewsOf(answer.lists ?? []) }));
      setPhase("idle");
    } catch (failure) {
      if (mine !== run.current) return;
      if (failure instanceof LimitReached) {
        setLimit(failure.span);
        setItems((now) => now.filter((item) => !item.queued));
        setPhase("idle");
      } else setPhase("failed");
    } finally {
      clearTimeout(timer);
    }
  };
  useEffect(() => {
    if (phase !== "idle" || accountId === "" || limit !== "") return;
    const next = nextQueued(items);
    if (!next) return;
    const sent = markSent(items, next.id);
    setItems(sent);
    void answerTo(sent, next.id);
  }, [items, phase, accountId, limit]);
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
            <ResultsPanel results={found.results} picked={found.picked} onPick={found.setPicked} />
          ) : (
            <Card>
              {items.length === 0 ? (
                <p className="assistant-empty">{askPlaceholder}</p>
              ) : (
                <BacklogSummariesLoader kinds={items.some((item) => (item.views ?? []).length > 0) ? [backlogViewKind] : []} client={backlogs}>
                  <Bubbles items={items} phase={phase} current={current} step={step} retry={() => void answerTo(items, current)} pick={found.pick} unqueue={(id) => setItems((now) => withoutItem(now, id))} ask={(words) => void send(words)} />
                </BacklogSummariesLoader>
              )}
              {confirmation.pending ? <ConfirmCard write={confirmation.pending.write} settle={confirmation.pending.settle} held={found.results} client={backlogs} /> : null}
              <div ref={end} />
            </Card>
          )}
          {limit !== "" ? <EmptyCard words={limitWords[limit]} /> : null}
        </div>
      ) : null}
      {model.state === "ready" && !unavailable && limit === "" ? (
        <div className="assistant-compose">
          <Composer placeholder={askPlaceholder} onSend={send} />
        </div>
      ) : null}
    </Shell>
  );
}
