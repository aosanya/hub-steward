import { useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { FormQuestion } from "../forms/api";
import { CouncilViewLink } from "../council/CouncilViewLink";
import { QuestionInput } from "../forms/QuestionInput";
import { useLoad } from "../forms/useLoad";
import { clearDraft, filled, given, loadDraft, saveDraft, stepDraftKey, type Draft, type Given } from "../forms/answers";
import { doSomethingBackLabel, doSomethingBackPath } from "../../app/routes";
import { BottomBar } from "../../shared/ui/BottomBar";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { Shell } from "../../app/Shell";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { ongoingTab, startTab, tabPathIn } from "../../app/tabs";
import { mcpStepsClient, newSendKey, StepRefused, refusalWords, type MemberStep, type SendRefusal, type StepsClient } from "./api";
import { ApproveInOwnName } from "./ApproveInOwnName";
import { AmendDraft } from "./AmendDraft";
import { ApprovalLimitNote } from "./ApprovalLimitNote";
import { amendmentsOf, type Edits } from "./amend";
import { PublishReport } from "./PublishReport";
import type { PublishClient } from "./publishApi";
import { answersOf, formQuestionsOf, placeRefsOf, unsendable } from "./questions";
import { afterWords, markSent } from "./sent";
import { loadDeclaredRow, rowTitleOf, type LoadedRow } from "../../app/menu/declaredRecord";
import { isRowStep, keptAnswersOf, landingOf, originOf, prefillOf } from "./rowStep";

const recordsSheets = (questions: FormQuestion[]) => questions.find((q) => q.prompt.startsWith("On whose behalf"));

const numeric = (type: string) => type === "number" || type === "currency";

const problemOf = (q: FormQuestion, draft: Draft, kept: Record<string, string>) => {
  if (unsendable(q)) return q.required && !kept[q.prompt] ? "This question needs a photo or file, which cannot be sent from here yet" : "";
  if (!filled(q, draft)) return q.required ? "This question needs an answer" : "";
  if (numeric(q.answer_type) && !Number.isFinite(Number(given(q, draft).text.trim()))) return "Enter a number";
  return "";
};

type FormProps = { step: MemberStep; steps: StepsClient; publisher?: PublishClient; loadedRow?: LoadedRow };

export function StepPage({ steps = mcpStepsClient, publisher }: { steps?: StepsClient; publisher?: PublishClient }) {
  const navigate = useNavigate();
  const origin = originOf(useLocation().state);
  const { stepId = "" } = useParams();
  const [params] = useSearchParams();
  const order = params.get("order") ?? "";
  const rowId = params.get("row") ?? "";
  const [attempt, setAttempt] = useState(0);
  const loaded = useLoad(() => steps.available(), `step:${stepId}:${order}:${attempt}`);
  const step = loaded.state === "ready" ? loaded.data.find((s) => s.id === stepId && s.orderId === order) : undefined;
  const back = () => navigate(origin.from?.path ?? doSomethingBackPath());
  const backLabel = origin.from?.title ?? doSomethingBackLabel();

  if (loaded.state === "loading") {
    return (
      <Shell title="" onBack={back} backLabel={backLabel}>
        <LoadingLine />
      </Shell>
    );
  }
  if (loaded.state === "error") {
    return (
      <Shell title="" onBack={back} backLabel={backLabel}>
        <LoadFailed words="This task could not be opened." onRetry={() => setAttempt(attempt + 1)} />
      </Shell>
    );
  }
  if (!step || (isRowStep(step) && rowId === "")) {
    return (
      <Shell title="" onBack={back} backLabel={backLabel}>
        <EmptyCard words="This task has closed." />
      </Shell>
    );
  }
  if (isRowStep(step)) return <RowStep step={step} rowId={rowId} steps={steps} publisher={publisher} />;
  return <StepForm key={`${step.id}:${order}`} step={step} steps={steps} publisher={publisher} />;
}

function RowStep({ step, rowId, steps, publisher }: { step: MemberStep; rowId: string; steps: StepsClient; publisher?: PublishClient }) {
  const navigate = useNavigate();
  const origin = originOf(useLocation().state);
  const row = useLoad(() => loadDeclaredRow(step.recordCode, rowId), `row-step:${openAgencyId()}:${step.recordCode}:${rowId}`);
  const back = () => navigate(origin.from?.path ?? doSomethingBackPath());
  const backLabel = origin.from?.title ?? doSomethingBackLabel();
  if (row.state === "loading") {
    return (
      <Shell title="" onBack={back} backLabel={backLabel}>
        <LoadingLine />
      </Shell>
    );
  }
  if (row.state === "error") {
    return (
      <Shell title="" onBack={back} backLabel={backLabel}>
        <LoadFailed words="This task could not be opened." />
      </Shell>
    );
  }
  if (row.data === null) {
    return (
      <Shell title="" onBack={back} backLabel={backLabel}>
        <EmptyCard words="This task has closed." />
      </Shell>
    );
  }
  return <StepForm key={`${step.id}:${rowId}`} step={step} steps={steps} publisher={publisher} loadedRow={row.data} />;
}

function StepForm({ step, steps, publisher, loadedRow }: FormProps) {
  const navigate = useNavigate();
  const origin = originOf(useLocation().state);
  const rowId = loadedRow?.row.id ?? "";
  const draftKey = stepDraftKey(step.id, rowId ? `${step.orderId}:row:${rowId}` : step.orderId);
  const kept = loadedRow && step.rowAction === "edit" ? keptAnswersOf(step.questions, loadedRow.row.answers) : {};
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = loadDraft(draftKey);
    if (Object.keys(saved).length > 0 || !loadedRow || step.rowAction !== "edit") return saved;
    return prefillOf(step.questions, loadedRow.row.answers);
  });
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [edits, setEdits] = useState<Edits>({});
  const [refusal, setRefusal] = useState("");
  const [refusedFor, setRefusedFor] = useState<SendRefusal | "">("");
  const [sendKey, setSendKey] = useState(newSendKey);
  const [sheets, setSheets] = useState(0);
  const [resting, setResting] = useState(false);
  const [recorded, setRecorded] = useState({ orderId: "", keptOrderId: "", after: "" });
  const back = () => navigate(origin.from?.path ?? doSomethingBackPath());
  const backLabel = origin.from?.title ?? doSomethingBackLabel();
  const leave = (rowId?: string) => navigate(landingOf(origin, rowId) ?? doSomethingBackPath());
  const title = step.generated === true ? step.workflowName || step.title : step.formName || step.title;
  const sub = loadedRow ? rowTitleOf(loadedRow.record, loadedRow.row, loadedRow.position) : step.generated === true ? undefined : step.workflowName || undefined;

  const questions = formQuestionsOf(step);
  const change = (id: string, patch: Partial<Given>) => {
    const next = { ...draft, [id]: { ...given(questions.find((q) => q.id === id)!, draft), ...patch } };
    setDraft(next);
    saveDraft(draftKey, next);
    setProblems((p) => ({ ...p, [id]: "" }));
  };
  const send = async () => {
    const found = Object.fromEntries(questions.map((q) => [q.id, problemOf(q, draft, kept)]));
    setProblems(found);
    if (Object.values(found).some(Boolean)) return;
    setStatus("sending");
    setRefusal("");
    setRefusedFor("");
    try {
      const answers = { ...kept, ...answersOf(questions, draft), ...amendmentsOf(step.earlier, edits) };
      const refs = placeRefsOf(questions, draft);
      const another = sheets > 0 ? { orderId: recorded.orderId } : undefined;
      const sent = rowId ? { ...step, rowId } : step;
      const reply = await (Object.keys(refs).length > 0
        ? steps.submit(sent, answers, sendKey, another, refs)
        : another
          ? steps.submit(sent, answers, sendKey, another)
          : steps.submit(sent, answers, sendKey));
      clearDraft(draftKey);
      if (step.generated === true) {
        leave(reply.rowId);
        return;
      }
      const after = afterWords(reply);
      if (!recordsSheets(questions)) {
        markSent({ id: step.id, orderId: step.orderId || reply.orderId, title: step.formName || step.title, after });
        leave();
        return;
      }
      const keptOrderId = sheets > 0 ? recorded.keptOrderId : markSent({ id: step.id, orderId: step.orderId || reply.orderId, title: step.formName || step.title });
      setRecorded({ orderId: sheets > 0 ? recorded.orderId : step.orderId || reply.orderId, keptOrderId, after });
      setSheets(sheets + 1);
      setResting(true);
      setStatus("idle");
    } catch (e) {
      setRefusedFor(e instanceof StepRefused ? e.reason : "failed");
      setRefusal(e instanceof StepRefused ? e.message : refusalWords.failed);
      setStatus("idle");
    }
  };

  const addAnotherSheet = () => {
    const behalf = recordsSheets(questions);
    const { [behalf!.id]: _cleared, ...kept } = draft;
    setDraft(kept);
    saveDraft(draftKey, kept);
    setSendKey(newSendKey());
    setResting(false);
  };
  const finished = () => {
    markSent({ id: step.id, orderId: recorded.keptOrderId, title: step.formName || step.title, after: recorded.after });
    leave();
  };

  if (resting) {
    return (
      <Shell title={title} sub={sub} onBack={back} backLabel={backLabel}>
        <Card>
          <p>Sheets recorded: {sheets}</p>
          <Button onClick={addAnotherSheet}>Add another sheet</Button>
          <Button kind="primary" onClick={finished}>Finished</Button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell title={title} sub={sub} onBack={back} backLabel={backLabel}>
      <Card>
        {step.description ? <p>{step.description}</p> : null}
        {step.prompt ? <p>{step.prompt}</p> : null}
        <CouncilViewLink step={step} />
        <PublishReport formName={step.formName || step.title} client={publisher} />
        {step.earlier.length ? <AmendDraft earlier={step.earlier} edits={edits} onChange={setEdits} /> : null}
        <ApprovalLimitNote limit={step.approvalLimit} />
        {step.approval ? <ApproveInOwnName /> : null}
        {questions.map((q) => (
          unsendable(q) ? (
            <div key={q.id}>
              <p className="meta">{q.prompt}: a photo or file cannot be sent from here yet</p>
              {problems[q.id] ? <p className="ferr">{problems[q.id]}</p> : null}
            </div>
          ) : (
            <QuestionInput key={q.id} q={q} value={given(q, draft)} error={problems[q.id] || undefined} onChange={(patch) => change(q.id, patch)} />
          )
        ))}
        {refusal ? <p className="ferr">{refusal}</p> : null}
        {refusedFor === "role" ? <Button to={tabPathIn(startTab, openAgencyId())}>Go to Start</Button> : null}
        {refusedFor === "not-ready" ? <Button to={tabPathIn(ongoingTab, openAgencyId())}>Go to Ongoing</Button> : null}
      </Card>
      <BottomBar>
        <Button onClick={back}>Back</Button>
        <Button kind="primary" disabled={status === "sending"} onClick={send}>
          {status === "sending" ? "Sending" : step.approval ? "Approve" : "Send"}
        </Button>
      </BottomBar>
    </Shell>
  );
}
