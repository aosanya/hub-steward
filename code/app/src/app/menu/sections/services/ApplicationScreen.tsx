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
import { useWord } from "../../../../features/agency/useWord";
import { listOf, text, type Item } from "../staff/staffData";
import { MenuEditForm, type EditField } from "../../MenuEditForm";
import { dayWords } from "../../../../shared/ui/days";
import { decidedWords, decisionStatus, reasonWords } from "./decision";

export const withdrawLabel = "Withdraw";

export const correctPermission = "application.correct";

const correctTool = "forms_submission_correct";

type SentAnswer = { id: string; questionId: string; prompt: string; valueKey: string; value: string };

const withdrawnWords = "Withdrawn";

const sentWords = "Sent";

const unwrapped = (reply: unknown): Item => ((reply as { item?: Item } | null)?.item ?? (reply as Item | null) ?? {}) as Item;

const valueKeys = ["value_text", "value_number", "value_date", "value_time"];

const valueKeyOf = (answer: Item) => valueKeys.find((key) => text(answer, key) !== "") ?? "";

const loadAnswers = async (formId: string) => {
  const [questions, answers] = await Promise.all([listOf("forms_question_list", { form_id: formId }), listOf("forms_answer_list", { form_id: formId })]);
  const prompts = new Map(questions.map((question) => [text(question, "id"), text(question, "prompt")]));
  const sent: SentAnswer[] = answers.map((answer) => {
    const valueKey = valueKeyOf(answer);
    return { id: text(answer, "id"), questionId: text(answer, "question_id"), prompt: prompts.get(text(answer, "question_id")) ?? "", valueKey, value: valueKey ? text(answer, valueKey) : "" };
  });
  return { sent, memberId: answers.map((answer) => text(answer, "member_id")).find((id) => id !== "") ?? "" };
};

function ApplicationCorrection({ formId, memberId, answers, onSaved }: { formId: string; memberId: string; answers: SentAnswer[]; onSaved: () => void }) {
  const editable = answers.filter((answer) => answer.valueKey !== "");
  if (!memberId || editable.length === 0) return null;
  const fields: EditField[] = editable.map((answer) => ({ label: answer.prompt, key: answer.id, kind: answer.valueKey === "value_number" ? "number" : "text" }));
  const build = (sent: Record<string, unknown>) => ({
    form_id: formId,
    member_id: memberId,
    answers: editable.filter((answer) => answer.id in sent).map((answer) => ({ question_id: answer.questionId, [answer.valueKey]: sent[answer.id] })),
  });
  return (
    <MenuEditForm
      item={Object.fromEntries(editable.map((answer) => [answer.id, answer.value]))}
      id={formId}
      idArg="form_id"
      tool={correctTool}
      permission={correctPermission}
      fields={fields}
      build={build}
      onSaved={onSaved}
    />
  );
}

function ApplicationAnswers({ formId, version, onCorrected }: { formId: string; version: number; onCorrected: () => void }) {
  const view = useLoad(() => loadAnswers(formId), `application-answers:${openAgencyId()}:${formId}:${version}`);
  if (view.state === "loading") return <LoadingLine />;
  if (view.state === "error") return <LoadFailed words={loadFailedWords} />;
  return (
    <>
      <Rows>
        {view.data.sent.map((answer) => (
          <ListRow key={answer.id || answer.prompt} title={answer.prompt} meta={answer.value} />
        ))}
      </Rows>
      <ApplicationCorrection formId={formId} memberId={view.data.memberId} answers={view.data.sent} onSaved={onCorrected} />
    </>
  );
}

const statusOf = (sent: Item) => (text(sent, "withdrawn_at") !== "" ? withdrawnWords : decisionStatus(text(sent, "decision")) || sentWords);

const decidedLine = (sent: Item) => {
  const by = text(sent, "decided_by");
  const day = dayWords(text(sent, "decided_at"));
  return [day, by].filter((part) => part !== "").join(" by ");
};

const loadApplication = async (id: string) => {
  const sent = unwrapped(await callTool("", "forms_submission_read_mine", { form_id: id }));
  return { ...sent, form_id: id, status: statusOf(sent), decided_line: decisionStatus(text(sent, "decision")) === "" ? "" : decidedLine(sent) };
};

const decisionFields = { [decidedWords]: "decided_line", [reasonWords]: "decision_note" };

export function useApplicationDetail() {
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const refresh = () => setVersion((current) => current + 1);
  const withdraw = (item: Item) => {
    setFailed(false);
    callTool("", "forms_form_withdraw", { form_id: text(item, "form_id") }).then(refresh, () => setFailed(true));
  };
  const detail = {
    tool: "forms_submission_read_mine",
    fields: decisionFields,
    status: "status",
    load: loadApplication,
    action: { label: withdrawLabel, tool: "forms_form_withdraw", run: withdraw, when: (item: Item) => text(item, "status") !== withdrawnWords },
    extra: (item: Item) => (
      <>
        {failed ? <LoadFailed words={actionFailedWords} /> : null}
        <ApplicationAnswers formId={text(item, "form_id")} version={version} onCorrected={refresh} />
      </>
    ),
  };
  return { detail, version };
}

export function ApplicationScreen() {
  const back = useBackToSection();
  const title = useWord("forms")("Application");
  const id = useParams().id ?? "";
  const { detail, version } = useApplicationDetail();
  return (
    <Shell title={title} titleUnder tabless {...back}>
      <MenuDetail key={version} bare title={title} id={id} {...detail} />
    </Shell>
  );
}
