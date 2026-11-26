import { useLoad } from "../../forms/useLoad";
import { useLanguage } from "../../../shared/language/language";
import { Card } from "../../../shared/ui/Card";
import { LoadFailed, LoadingLine } from "../../../shared/ui/LoadState";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { rulePath } from "../rulebook/paths";
import { useAnswering } from "./answering";
import { QuestionBlock } from "./QuestionBlock";
import type { QuestionsClient } from "./types";

type Props = { backlogId: string; statuses: string[]; client: QuestionsClient; state: unknown; query?: string };

export function QuestionsList({ backlogId, statuses, client, state, query = "" }: Props) {
  const { words } = useLanguage();
  const { answerOf, shown } = useAnswering(client);
  const found = useLoad(async () => ({ questions: await client.list(backlogId, statuses), standing: await client.standing() }), `question-list:${openAgencyId()}:${backlogId}:${statuses.join(",")}`);
  if (found.state === "loading") return <LoadingLine />;
  if (found.state === "error") return <LoadFailed words={words.questionsLoadFailed} />;
  const { questions, standing } = found.data;
  const needle = query.trim().toLowerCase();
  const held = needle === "" ? questions : questions.filter((one) => `${one.code} ${one.title}`.toLowerCase().includes(needle));
  return (
    <>
      {held.map((question) => (
        <Card key={question.code}>
          <QuestionBlock question={shown(question)} canAnswer={standing.holds(question.targetRole)} onAnswer={answerOf(question)} to={rulePath(question.code)} state={state} />
        </Card>
      ))}
    </>
  );
}
