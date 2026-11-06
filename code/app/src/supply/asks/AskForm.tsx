import { useEffect, useState } from "react";
import type { Ask, AskAnswer } from "../../chat/api";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { dayWords } from "../../ui/days";
import { stockText, type StockLine, type StockReader } from "./stock";

export function AskForm({
  ask,
  onAnswer,
  readStock,
  showAnswer = false,
}: {
  ask: Ask;
  onAnswer: (reply: AskAnswer) => Promise<void>;
  readStock: StockReader;
  showAnswer?: boolean;
}) {
  const [stock, setStock] = useState<StockLine | null>(null);
  const [yes, setYes] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [said, setSaid] = useState(ask.answer === "yes" || ask.answer === "no" ? ask.answer : "");
  const [sent, setSent] = useState<AskAnswer | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    readStock({ question: ask.question, detail: ask.detail })
      .then(setStock)
      .catch(() => setStock(null));
  }, [readStock, ask.question, ask.detail]);

  const send = async (reply: AskAnswer) => {
    setFailed(false);
    try {
      await onAnswer(reply);
      setSent(reply);
      setSaid(reply.answer);
    } catch {
      setFailed(true);
    }
  };

  return (
    <Card>
      {ask.asker ? <p className="meta">{ask.asker}</p> : null}
      <p className="ttl">{ask.question}</p>
      {ask.detail ? <p>{ask.detail}</p> : null}
      {stock ? (
        <>
          <h2 className="heading">Only you see this</h2>
          <p className="meta">{stockText(stock)}</p>
        </>
      ) : null}
      {said ? (
        <>
          <p>You said {said}.</p>
          {showAnswer && sent ? (
            <>
              <h2 className="heading">Your answer</h2>
              <Rows>
                <ListRow
                  title={sent.date ? dayWords(sent.date) : "No"}
                  meta={sent.note}
                  end={sent.date ? <Chip tone="success">Yes</Chip> : undefined}
                />
              </Rows>
            </>
          ) : null}
        </>
      ) : yes ? (
        <>
          <h2 className="heading">{ask.asker ? `Yes to ${ask.asker}` : "Yes"}</h2>
          <Field label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Field label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button kind="primary" disabled={!date} onClick={() => send({ answer: "yes", date, note })}>
            Send yes
          </Button>
        </>
      ) : (
        <>
          <Button onClick={() => send({ answer: "no" })}>No</Button>
          <Button kind="primary" onClick={() => setYes(true)}>
            Yes
          </Button>
        </>
      )}
      {failed ? <p>The answer was not sent. Try again.</p> : null}
    </Card>
  );
}
