import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMay } from "../../../../features/agency/useMay";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow } from "../../../../shared/ui/ListRow";
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
import { valueKeyOf } from "./answers";
import { certificateFields, certificateOf, decidedWords, decisionStatus, reasonWords, sentWords } from "./decision";
import { inspectionLineOf, inspectionWords } from "./inspection";
import { ChatAboutService } from "./ChatAboutService";
import { servicesPaths } from "./paths";
import { ServiceAct, ServiceDetails, ServiceHead } from "./ServicePage";
import { Section } from "../../../../shared/ui/Section";

export const withdrawLabel = "Withdraw";

export const correctPermission = "application.correct";

const correctTool = "forms_submission_correct";

type SentAnswer = { id: string; questionId: string; prompt: string; valueKey: string; value: string };

const withdrawnWords = "Withdrawn";

const unwrapped = (reply: unknown): Item => ((reply as { item?: Item } | null)?.item ?? (reply as Item | null) ?? {}) as Item;

const loadAnswers = async (formId: string) => {
  const [questions, answers] = await Promise.all([listOf("forms_question_list", { form_id: formId }), listOf("forms_answer_list", { form_id: formId })]);
  const prompts = new Map(questions.map((question) => [text(question, "id"), text(question, "prompt")]));
  const sent: SentAnswer[] = answers.map((answer) => {
    const valueKey = valueKeyOf(answer);
    return { id: text(answer, "id"), questionId: text(answer, "question_id"), prompt: prompts.get(text(answer, "question_id")) ?? "", valueKey, value: valueKey ? text(answer, valueKey) : "" };
  });
  return { sent, memberId: answers.map((answer) => text(answer, "member_id")).find((id) => id !== "") ?? "" };
};

function ApplicationAnswers({ formId, version, onCorrected, withdrawable, onWithdraw }: { formId: string; version: number; onCorrected: () => void; withdrawable: boolean; onWithdraw: () => void }) {
  const view = useLoad(() => loadAnswers(formId), `application-answers:${openAgencyId()}:${formId}:${version}`);
  const mayCorrect = useMay(correctPermission);
  const [editing, setEditing] = useState(false);
  if (view.state === "loading") return <LoadingLine />;
  if (view.state === "error") return <LoadFailed words={loadFailedWords} />;
  const { sent, memberId } = view.data;
  const editable = sent.filter((answer) => answer.valueKey !== "");
  const canCorrect = mayCorrect && memberId !== "" && editable.length > 0;
  if (editing && canCorrect) {
    const fields: EditField[] = editable.map((answer) => ({ label: answer.prompt, key: answer.id, kind: answer.valueKey === "value_number" ? "number" : "text" }));
    const build = (changed: Record<string, unknown>) => ({
      form_id: formId,
      member_id: memberId,
      answers: editable.filter((answer) => answer.id in changed).map((answer) => ({ question_id: answer.questionId, [answer.valueKey]: changed[answer.id] })),
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
        bare
        openCount={1}
        onSaved={() => {
          setEditing(false);
          onCorrected();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  const foot =
    withdrawable || canCorrect ? (
      <>
        {withdrawable ? <ServiceAct label={withdrawLabel} onClick={onWithdraw} quiet /> : null}
        {canCorrect ? <ServiceAct label="Edit" onClick={() => setEditing(true)} /> : null}
      </>
    ) : undefined;
  return <Section word="Application" plain foot={foot} empty={{ words: "No answers were sent." }} rows={sent.map((answer) => <ListRow key={answer.id || answer.prompt} title={answer.prompt} meta={answer.value} />)} />;
}

const statusOf = (sent: Item) => (text(sent, "withdrawn_at") !== "" ? withdrawnWords : decisionStatus(text(sent, "decision")) || sentWords);

const decidedLine = (sent: Item) => {
  const by = text(sent, "decided_by");
  const day = dayWords(text(sent, "decided_at"));
  return [day, by].filter((part) => part !== "").join(" by ");
};

const titleOf = async (formId: string) => text((await listOf("forms_form_list_answered").catch(() => [])).find((form) => text(form, "form_id") === formId) ?? {}, "title");

const loadApplication = async (id: string) => {
  const [sent, title] = await Promise.all([callTool("", "forms_submission_read_mine", { form_id: id }).then(unwrapped), titleOf(id)]);
  return { ...sent, form_id: id, name: title, status: statusOf(sent), decided_line: decisionStatus(text(sent, "decision")) === "" ? "" : decidedLine(sent), inspection_line: inspectionLineOf(sent), ...certificateOf(sent) };
};

const decisionFields = { [decidedWords]: "decided_line", [reasonWords]: "decision_note", [inspectionWords]: "inspection_line", ...certificateFields };

export function useApplicationDetail(backOf: (id: string) => string) {
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const refresh = () => setVersion((current) => current + 1);
  const withdraw = (item: Item) => {
    setFailed(false);
    callTool("", "forms_form_withdraw", { form_id: text(item, "form_id") }).then(refresh, () => setFailed(true));
  };
  const detail = {
    tool: "forms_submission_read_mine",
    fields: {},
    status: "",
    load: loadApplication,
    extra: (item: Item) => (
      <>
        <ChatAboutService about={{ kind: "application", id: text(item, "form_id"), name: text(item, "name") }} back={backOf(text(item, "form_id"))} />
        <ServiceHead title={text(item, "name") || "Application"} status={text(item, "status")} line={dayWords(text(item, "answered_at") || text(item, "sent_at"))} />
        <ServiceDetails word="Decision" item={item} fields={decisionFields} />
        {failed ? <LoadFailed words={actionFailedWords} /> : null}
        <ApplicationAnswers
          formId={text(item, "form_id")}
          version={version}
          onCorrected={refresh}
          withdrawable={text(item, "status") !== withdrawnWords}
          onWithdraw={() => withdraw(item)}
        />
      </>
    ),
  };
  return { detail, version };
}

export function ApplicationScreen() {
  const back = useBackToSection();
  const title = useWord("forms")("Application");
  const id = useParams().id ?? "";
  const { detail, version } = useApplicationDetail(() => servicesPaths.application.path({ id }));
  return (
    <Shell title={title} titleUnder tabless {...back}>
      <MenuDetail key={version} bare title={title} id={id} {...detail} />
    </Shell>
  );
}
