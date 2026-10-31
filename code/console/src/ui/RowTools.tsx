import { useState, type FormEvent, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { useAskChat } from "../shell/chatTell";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { TextControl } from "./Controls";

type RowToolsProps = {
  question: (text: string) => string;
  background?: () => Promise<string>;
  asking?: boolean;
  children: ReactNode;
};

export function RowTools({ question, background, asking = true, children }: RowToolsProps) {
  const { t } = useI18n();
  const ask = useAskChat();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const asked = question(text.trim());
    setText("");
    const around = background ? await background().catch(() => "") : "";
    ask(asked, around || undefined);
  };

  return (
    <>
      <div className="row-tools">
        {asking ? (
          <button type="button" className="row-tool" aria-expanded={open} onClick={() => setOpen((now) => !now)}>
            {t("suggest.ask")}
          </button>
        ) : null}
        {children}
      </div>
      {open && asking ? (
        <form className="row-ask" onSubmit={send}>
          <TextControl label={t("suggest.ask")} placeholder={t("suggest.ask")} value={text} onChange={setText} />
          <Button kind="quiet" size="xs" type="submit" disabled={!text.trim()}>
            {t("suggest.send")}
          </Button>
        </form>
      ) : null}
    </>
  );
}

type EnhanceToolProps = { message: string; background?: () => Promise<string>; onChanged?: () => void; shown?: string };

export function EnhanceTool({ message, background, onChanged, shown }: EnhanceToolProps) {
  const { t } = useI18n();
  const ask = useAskChat();
  const [reading, setReading] = useState(0);
  const [queued, setQueued] = useState(0);

  const enhance = async () => {
    setReading((now) => now + 1);
    const around = background ? await background().catch(() => "") : "";
    setReading((now) => now - 1);
    setQueued((now) => now + 1);
    ask(message, around || undefined, onChanged, () => setQueued((now) => now - 1), shown);
  };

  const busy = reading + queued > 0;
  return (
    <button type="button" className="row-tool" disabled={busy} aria-busy={busy} onClick={enhance}>
      {busy ? <span className="tool-spin" aria-hidden="true" /> : <Icon name="wand" size={14} />}
      {t("enhance.button")}
    </button>
  );
}
