import { useState } from "react";
import { Button } from "../../ui/Button";
import type { ButtonSpec, CardSpec, ToolRunner } from "./types";

type Props = {
  cards: CardSpec[];
  shown: number;
  more?: string;
  onPrompt: (text: string) => void;
  onTool: ToolRunner;
};

type Outcome = { state: "done" } | { state: "failed"; message: string };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function CardButton({ spec, onPrompt, onTool, onOutcome }: { spec: ButtonSpec; onPrompt: Props["onPrompt"]; onTool: ToolRunner; onOutcome: (outcome: Outcome) => void }) {
  const [busy, setBusy] = useState(false);
  if (spec.to) {
    return (
      <Button className="inline" to={spec.to}>
        {spec.label}
      </Button>
    );
  }
  const press = async () => {
    if (spec.tool) {
      setBusy(true);
      try {
        await onTool(spec.tool, spec.args ?? {});
        onOutcome({ state: "done" });
      } catch (error) {
        onOutcome({ state: "failed", message: messageOf(error) });
      } finally {
        setBusy(false);
      }
      return;
    }
    onPrompt(spec.prompt ?? spec.label);
  };
  return (
    <Button className="inline" disabled={busy} onClick={press}>
      {spec.label}
    </Button>
  );
}

function CardView({ card, onPrompt, onTool }: { card: CardSpec; onPrompt: Props["onPrompt"]; onTool: ToolRunner }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  return (
    <article className="attached">
      <span className="ttl">{card.title}</span>
      {card.lines.map((line, index) => (
        <span key={index} className="line">
          {line}
        </span>
      ))}
      {card.buttons.length > 0 ? (
        <div className="btns">
          {card.buttons.map((spec) => (
            <CardButton key={spec.label} spec={spec} onPrompt={onPrompt} onTool={onTool} onOutcome={setOutcome} />
          ))}
        </div>
      ) : null}
      {outcome?.state === "done" ? <p className="note success">Done</p> : null}
      {outcome?.state === "failed" ? <p className="ferr" role="alert">{outcome.message}</p> : null}
    </article>
  );
}

export function CardsBlock({ cards, shown, more, onPrompt, onTool }: Props) {
  const step = Math.max(1, shown);
  const [count, setCount] = useState(step);
  const visible = cards.slice(0, count);
  return (
    <>
      {visible.map((card) => (
        <CardView key={card.id} card={card} onPrompt={onPrompt} onTool={onTool} />
      ))}
      {count < cards.length ? (
        <Button className="inline showmore" onClick={() => setCount(count + step)}>
          {more ?? "Show more"}
        </Button>
      ) : null}
    </>
  );
}
