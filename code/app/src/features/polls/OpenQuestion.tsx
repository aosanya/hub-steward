import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { ChoiceGroup, ChoiceRow } from "../../shared/ui/ChoiceRow";
import { ListRow } from "../../shared/ui/ListRow";
import { answerPoll, type OpenPoll } from "./api";
import { AnswerCount } from "./AnswerCount";

type Sending = { state: "idle" | "sending" | "sent" } | { state: "refused"; words: string };

export function OpenQuestion({ poll }: { poll: OpenPoll }) {
  const [picked, setPicked] = useState("");
  const [sending, setSending] = useState<Sending>({ state: "idle" });
  const send = async () => {
    setSending({ state: "sending" });
    try {
      await answerPoll(poll.id, picked);
      setSending({ state: "sent" });
    } catch (error) {
      setSending({ state: "refused", words: (error as Error).message });
    }
  };
  const sent = sending.state === "sent";
  return (
    <Card>
      {poll.answered ? (
        <ListRow title={poll.question} end={<Chip>Answered</Chip>} />
      ) : (
        <>
          <ChoiceGroup label={poll.question} error={sending.state === "refused" ? sending.words : undefined}>
            {poll.choices.map((choice) => (
              <ChoiceRow key={choice.id} type="radio" name={poll.id} label={choice.label} checked={picked === choice.id} onChange={() => setPicked(choice.id)} />
            ))}
          </ChoiceGroup>
          {sent ? (
            <p role="status">Your answer was sent.</p>
          ) : (
            <Button kind="primary" disabled={picked === "" || sending.state === "sending"} onClick={send}>
              Send
            </Button>
          )}
        </>
      )}
      <AnswerCount pollId={poll.id} />
    </Card>
  );
}
