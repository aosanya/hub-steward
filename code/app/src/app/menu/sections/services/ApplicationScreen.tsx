import { useState } from "react";
import { useParams } from "react-router-dom";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { Shell } from "../../../Shell";
import { MenuDetail, actionFailedWords, loadFailedWords } from "../../MenuDetail";
import { useBackToSection } from "../../useBackToSection";
import { listOf, text, type Item } from "../staff/staffData";

export const withdrawLabel = "Withdraw";

const withdrawnWords = "Withdrawn";

const sentWords = "Sent";

const unwrapped = (reply: unknown): Item => ((reply as { item?: Item } | null)?.item ?? (reply as Item | null) ?? {}) as Item;

const answerValue = (answer: Item) =>
  ["value_text", "value_number", "value_date", "value_time"].map((key) => text(answer, key)).find((value) => value !== "") ?? "";

const loadAnswers = async (formId: string) => {
  const [questions, answers] = await Promise.all([listOf("forms_question_list", { form_id: formId }), listOf("forms_answer_list", { form_id: formId })]);
  const prompts = new Map(questions.map((question) => [text(question, "id"), text(question, "prompt")]));
  return answers.map((answer) => ({ id: text(answer, "id"), prompt: prompts.get(text(answer, "question_id")) ?? "", value: answerValue(answer) }));
};

function ApplicationAnswers({ formId, version }: { formId: string; version: number }) {
  const view = useLoad(() => loadAnswers(formId), `application-answers:${openAgencyId()}:${formId}:${version}`);
  if (view.state === "loading") return <LoadingLine />;
  if (view.state === "error") return <LoadFailed words={loadFailedWords} />;
  return (
    <Rows>
      {view.data.map((answer) => (
        <ListRow key={answer.id || answer.prompt} title={answer.prompt} meta={answer.value} />
      ))}
    </Rows>
  );
}

export function ApplicationScreen() {
  const back = useBackToSection();
  const id = useParams().id ?? "";
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const load = async () => {
    const sent = unwrapped(await callTool("", "forms_submission_read_mine", { form_id: id }));
    return { ...sent, status: text(sent, "withdrawn_at") === "" ? sentWords : withdrawnWords };
  };
  const withdraw = () => {
    setFailed(false);
    callTool("", "forms_form_withdraw", { form_id: id }).then(
      () => setVersion((current) => current + 1),
      () => setFailed(true),
    );
  };
  return (
    <Shell title="Application" titleUnder tabless {...back}>
      <MenuDetail
        key={version}
        bare
        title="Application"
        tool="forms_submission_read_mine"
        fields={{}}
        status="status"
        id={id}
        load={load}
        action={{ label: withdrawLabel, tool: "forms_form_withdraw", run: withdraw, when: (item) => text(item, "status") !== withdrawnWords }}
      />
      {failed ? <LoadFailed words={actionFailedWords} /> : null}
      <ApplicationAnswers formId={id} version={version} />
    </Shell>
  );
}
