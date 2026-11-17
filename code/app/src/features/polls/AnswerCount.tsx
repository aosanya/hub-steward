import { useLoad } from "../forms/useLoad";
import { ListRow, Rows } from "../../shared/ui/ListRow";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { readCount } from "./api";

export function AnswerCount({ pollId }: { pollId: string }) {
  const count = useLoad(() => readCount(pollId), `count:${openAgencyId()}:${pollId}`);
  if (count.state !== "ready" || count.data === null) return null;
  return (
    <Rows>
      {count.data.choices.map((choice) => (
        <ListRow key={choice.choiceId} title={`${choice.label}: ${choice.votes}`} />
      ))}
      <ListRow title={`${count.data.answered} answered`} />
    </Rows>
  );
}
