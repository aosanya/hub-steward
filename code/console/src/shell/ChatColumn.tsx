import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import type { ChatAnswer } from "../data/chatAnswer";
import { loadTurns, saveTurns } from "../data/chatMemory";
import { hintKeys, pageIcon, type ChipWords } from "../data/menu";
import { askModel, type Turn } from "../data/modelChat";
import { useI18n } from "../i18n";
import { MsgAssistant, MsgError } from "../ui";
import { Icon } from "../ui/Icon";
import type { Told } from "./chatTell";
import { ChatModelPicker } from "./ChatModelPicker";
import { ChatTurns } from "./ChatTurns";
import { pageLabel, withPage, withStep } from "./labels";
import { useChatModels } from "./useChatModels";
import "./chatBox.css";

type ChatColumnProps = {
  hubId: string;
  page: string;
  rail: boolean;
  onToggleRail: () => void;
  onAttach?: (fileName: string) => void;
  onAnswer?: (answer: ChatAnswer) => void;
  onChanged?: (page: string) => void;
  told?: Told | null;
  queue?: Told[];
  onTake?: (id: number) => void;
  onCancelQueued?: (id: number) => void;
  onCancelAll?: () => void;
  chipWords?: ChipWords;
};

const lastAnswerOf = (turns: Turn[]): ChatAnswer | undefined => [...turns].reverse().find((turn) => turn.answer?.kind === "tools")?.answer;

export function ChatColumn({ hubId, page, rail, onToggleRail, onAttach, onAnswer, onChanged, told, queue = [], onTake, onCancelQueued, onCancelAll, chipWords = {} }: ChatColumnProps) {
  const { t } = useI18n();
  const models = useChatModels(hubId);
  const [turns, setTurns] = useState<Turn[]>(() => loadTurns(hubId));
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [seen, setSeen] = useState(0);
  const sending = useRef(false);
  const heard = useRef(told?.id ?? 0);
  const lastTaken = useRef(0);
  const running = useRef<AbortController | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const label = pageLabel(t, page);
  const unread = rail && turns.length > seen;

  useEffect(() => {
    saveTurns(hubId, turns);
  }, [hubId, turns]);

  useEffect(() => {
    const kept = lastAnswerOf(turns);
    if (kept) onAnswer?.(kept);
  }, []);

  useEffect(() => {
    if (!told || told.id === heard.current) return;
    heard.current = told.id;
    setTurns((current) => [...current, { role: "assistant", content: told.text }]);
  }, [told]);

  useEffect(() => {
    const next = queue[0];
    if (!next || waiting || sending.current || next.id <= lastTaken.current) return;
    lastTaken.current = next.id;
    onTake?.(next.id);
    if (next.typed) {
      suggest(next.text);
      return;
    }
    send(next.text, next.background, next.afterChange, next.settled, next.shown);
  }, [queue, waiting]);

  useEffect(() => {
    if (!rail) setSeen(turns.length);
  }, [rail, turns.length]);

  const send = async (given?: string, background?: string, afterChange?: () => void, settled?: () => void, shown?: string) => {
    const text = (given ?? draft).trim();
    if (!text || sending.current) {
      settled?.();
      return;
    }
    sending.current = true;
    const asked: Turn = { role: "user", content: text, ...(shown ? { shown } : {}) };
    const thread: Turn[] = [...turns, asked];
    setTurns(thread);
    if (given === undefined) setDraft("");
    setFailed(null);
    setWaiting(true);
    const controller = new AbortController();
    running.current = controller;
    try {
      const reply = await askModel(hubId, models.currentId, thread, page, background ?? "", controller.signal);
      setTurns([
        ...(reply.newTopic ? [...turns, { ...asked, newTopic: true }] : thread),
        { role: "assistant", content: reply.text, ...(reply.calls.length > 0 ? { calls: reply.calls } : {}), ...(reply.answer ? { answer: reply.answer } : {}) },
      ]);
      if (reply.answer) onAnswer?.(reply.answer);
      if (reply.changed) {
        onChanged?.(reply.changed);
        afterChange?.();
      }
    } catch (error) {
      setTurns(turns);
      if (!controller.signal.aborted) {
        if (given === undefined) setDraft((typed) => (typed === "" ? text : typed));
        setFailed(error instanceof Error ? error.message : "");
      }
    }
    running.current = null;
    setWaiting(false);
    sending.current = false;
    settled?.();
  };

  const stop = () => {
    running.current?.abort();
    onCancelAll?.();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };

  const sendOnEnter = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    send();
  };

  const attach = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onAttach?.(file.name);
  };

  const suggest = (text: string) => {
    setDraft(text);
    composer.current?.focus();
  };

  if (rail) {
    return (
      <aside className="chat rail" aria-label={t("chatCollapsed")}>
        <span className="rail-ico">
          <Icon name="chat" size={20} />
          {unread ? <span className="rail-dot" role="img" aria-label={t("chatUnread")} /> : null}
        </span>
        <button type="button" className="chat-collapse" aria-label={t("chatOpen")} aria-expanded={false} onClick={onToggleRail}>
          <Icon name="panel-right" size={18} />
        </button>
      </aside>
    );
  }

  const quiet = turns.length === 0;
  return (
    <aside className="chat" aria-label={t("chatTitle")}>
      <div className="chat-head">
        <h2 className="chat-label">{t("chatTitle")}</h2>
        <span className="chat-ctx">
          <Icon name={pageIcon(page)} size={14} />
          {label}
        </span>
        <button type="button" className="chat-collapse" aria-label={t("chatRail")} aria-expanded onClick={onToggleRail}>
          <Icon name="panel-right" size={18} />
        </button>
      </div>
      <div className="thread">
        <div className="thread-in">
          {quiet ? (
            <MsgAssistant>{withPage(t("chatGreeting"), label)}</MsgAssistant>
          ) : (
            <ChatTurns turns={turns} />
          )}
          {failed !== null ? (
            <div role="alert">
              <MsgError>{[t("submitFailed"), failed].filter(Boolean).join(" ")}</MsgError>
            </div>
          ) : null}
        </div>
      </div>
      {quiet ? (
        <div className="chat-chips">
          {hintKeys(page, models.hasModels, chipWords).map((key) => (
            <button key={key} type="button" className="sugg" onClick={() => suggest(withStep(t(key), chipWords.step))}>
              <Icon name="sparkle" size={12} />
              {withStep(t(key), chipWords.step)}
            </button>
          ))}
        </div>
      ) : null}
      {queue.length > 0 ? (
        <ul className="chat-queue" aria-label={t("chatQueued")}>
          <li className="chat-queue-line" aria-hidden="true">
            {t("chatQueuedLine")}
          </li>
          {queue.map((ask) => (
            <li key={ask.id} className="bubble">
              <span>{ask.shown ?? ask.text}</span>
              <button type="button" aria-label={`${t("chatUnqueue")}: ${ask.shown ?? ask.text}`} onClick={() => onCancelQueued?.(ask.id)}>
                <Icon name="cross" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="chat-input" onSubmit={submit}>
        <div className="composer">
          <label>
            <span className="sr">{t("composer")}</span>
            <textarea
              ref={composer}
              rows={3}
              placeholder={withPage(t("chatAsk"), label)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={sendOnEnter}
            />
          </label>
          <div className="composer-bar">
            <span className="chat-tools">
              <input ref={picker} type="file" className="chat-file" tabIndex={-1} aria-hidden="true" onChange={attach} />
              <button type="button" className="chat-attach" aria-label={t("chatAttach")} onClick={() => picker.current?.click()}>
                <Icon name="paperclip" size={18} />
              </button>
              <ChatModelPicker options={models.options} currentId={models.currentId} onPick={models.pick} />
            </span>
            {waiting ? (
              <button type="button" className="chat-send" aria-label={t("chatStop")} onClick={stop}>
                <Icon name="stop" size={18} />
              </button>
            ) : (
              <button type="submit" className="chat-send" aria-label={t("chatSend")}>
                <Icon name="arrow-up" size={18} stroke={2.4} />
              </button>
            )}
          </div>
        </div>
      </form>
    </aside>
  );
}
