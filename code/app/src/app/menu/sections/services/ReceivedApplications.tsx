import { useState } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { dayWords } from "../../../../shared/ui/days";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";
import { listOf, text, type Item } from "../staff/staffData";
import { peopleRows } from "../residents/PeopleScreens";
import { answerWordsOf } from "./answers";
import { decisionStatus, reasonWords, sentWords } from "./decision";
import { announceDecision } from "./decisionSignal";
import { GrantFields, grantExtras } from "./GrantFields";
import { InspectionForm } from "./InspectionForm";
import { inspectionLineOf, inspectionWords } from "./inspection";
import { readItem } from "./readItem";

const sectionWords = "Applications received";

const grantLabel = "Grant";

const refuseLabel = "Refuse";

const unnamedWords = "Someone";

const chevron = "›";

export type Received = { memberId: string; name: string; status: string; line: string; note: string; inspection: string; undecided: boolean; decidedAt: string; validUntil: string };

const received = (sent: Item, names: Map<string, string>): Received => {
  const status = decisionStatus(text(sent, "decision"));
  const day = dayWords(text(sent, status === "" ? "submitted_at" : "decided_at"));
  return {
    memberId: text(sent, "member_id"),
    name: names.get(text(sent, "member_id")) ?? unnamedWords,
    status: status || sentWords,
    line: `${status || sentWords} ${day}`,
    note: text(sent, "decision_note"),
    inspection: inspectionLineOf(sent),
    undecided: status === "",
    decidedAt: text(sent, "decided_at"),
    validUntil: text(sent, "valid_until"),
  };
};

const ownId = async () => text(await readItem("actor_get_my_actor", {}), "id");

export const loadReceived = async (slug: string) => {
  const formId = text(await readItem("forms_catalog_entry_read", { slug }), "form_id");
  if (formId === "") throw new Error("entry without a form");
  const [sent, people, own] = await Promise.all([listOf("forms_submission_list", { form_id: formId }), peopleRows(), ownId()]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  return { formId, own, rows: sent.map((one) => received(one, names)) };
};

const loadAnswers = async (formId: string, memberId: string) => {
  const [questions, answers] = await Promise.all([listOf("forms_question_list", { form_id: formId }), listOf("forms_answer_list_all", { form_id: formId, member_id: memberId })]);
  const prompts = new Map(questions.map((question) => [text(question, "id"), text(question, "prompt")]));
  return answers.map((answer) => ({ id: text(answer, "id"), prompt: prompts.get(text(answer, "question_id")) ?? "", value: answerWordsOf(answer) }));
};

function DecideButtons({ formId, memberId, onDecided }: { formId: string; memberId: string; onDecided: () => void }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [certificate, setCertificate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [refused, setRefused] = useState("");
  const decide = async (decision: "approved" | "refused", note: string, extras: Record<string, string> = {}) => {
    setBusy(true);
    setRefused("");
    try {
      await callTool("", "forms_submission_decide", { form_id: formId, member_id: memberId, decision, note, ...extras });
      onDecided();
    } catch (error) {
      setRefused(refusalWords(error));
      setBusy(false);
    }
  };
  const refuse = () => (asking ? decide("refused", reason.trim()) : setAsking(true));
  return (
    <>
      <GrantFields certificate={certificate} validUntil={validUntil} onCertificate={setCertificate} onValidUntil={setValidUntil} />
      {asking ? <TextArea label={reasonWords} value={reason} onChange={(event) => setReason(event.target.value)} /> : null}
      <Button kind="primary" disabled={busy} onClick={() => decide("approved", "", grantExtras(certificate, validUntil))}>{grantLabel}</Button>
      <Button kind="danger" disabled={busy || (asking && reason.trim() === "")} onClick={refuse}>{refuseLabel}</Button>
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

function ApplicationAnswers({ formId, row, mine, onDecided, onInspected }: { formId: string; row: Received; mine: boolean; onDecided: () => void; onInspected: () => void }) {
  const view = useLoad(() => loadAnswers(formId, row.memberId), `received-answers:${openAgencyId()}:${formId}:${row.memberId}`);
  if (view.state === "loading") return <LoadingLine />;
  if (view.state === "error") return null;
  return (
    <>
      <Rows>
        {view.data.map((answer) => (
          <ListRow key={answer.id || answer.prompt} title={answer.prompt} meta={answer.value} />
        ))}
        {row.note !== "" ? <ListRow title={reasonWords} meta={row.note} /> : null}
        {row.inspection !== "" ? <ListRow title={inspectionWords} meta={row.inspection} /> : null}
      </Rows>
      {mine ? null : <InspectionForm formId={formId} memberId={row.memberId} inspected={row.inspection !== ""} onRecorded={onInspected} />}
      {row.undecided && !mine ? <DecideButtons formId={formId} memberId={row.memberId} onDecided={onDecided} /> : null}
    </>
  );
}

function ReceivedList({ slug }: { slug: string }) {
  const [version, setVersion] = useState(0);
  const [chosen, setChosen] = useState("");
  const view = useLoad(() => loadReceived(slug), `received:${openAgencyId()}:${slug}:${version}`);
  if (view.state !== "ready" || view.data.rows.length === 0) return null;
  const { formId, own, rows } = view.data;
  const open = rows.find((row) => row.memberId === chosen);
  const inspected = () => setVersion((current) => current + 1);
  const decided = () => {
    announceDecision();
    setChosen("");
    setVersion((current) => current + 1);
  };
  return (
    <>
      <SectionHeading>{sectionWords}</SectionHeading>
      <Rows>
        {rows.map((row) => (
          <ListRow key={row.memberId} title={row.name} meta={row.line} end={chevron} pressed={row.memberId === chosen} onClick={() => setChosen(row.memberId === chosen ? "" : row.memberId)} />
        ))}
      </Rows>
      {open ? <ApplicationAnswers key={open.memberId} formId={formId} row={open} mine={open.memberId === own} onDecided={decided} onInspected={inspected} /> : null}
    </>
  );
}

export function ReceivedApplications({ slug }: { slug: string }) {
  const mayDecide = useMay("application.decide");
  const mayReadResults = useMay("form.results");
  const mayReadAnswers = useMay("form.answers.read");
  return mayDecide && mayReadResults && mayReadAnswers ? <ReceivedList slug={slug} /> : null;
}
