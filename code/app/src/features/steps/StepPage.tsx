import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { FormQuestion } from "../forms/api";
import { CouncilViewLink } from "../council/CouncilViewLink";
import { QuestionInput } from "../forms/QuestionInput";
import { useLoad } from "../forms/useLoad";
import { clearDraft, filled, given, loadDraft, saveDraft, stepDraftKey, type Draft, type Given } from "../forms/answers";
import { doSomethingBackPath } from "../../app/routes";
import { BottomBar } from "../../shared/ui/BottomBar";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { EmptyCard, LoadFailed, LoadingLine } from "../../shared/ui/LoadState";
import { Shell } from "../../app/Shell";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { ongoingTab, startTab, tabPathIn } from "../../app/tabs";
import { mcpStepsClient, newSendKey, StepRefused, refusalWords, type SendRefusal, type StepsClient } from "./api";
import { ApproveInOwnName } from "./ApproveInOwnName";
import { AmendDraft } from "./AmendDraft";
import { ApprovalLimitNote } from "./ApprovalLimitNote";
import { amendmentsOf, type Edits } from "./amend";
import { PublishReport } from "./PublishReport";
import type { PublishClient } from "./publishApi";
import { answersOf, formQuestionsOf, placeRefsOf, unsendable } from "./questions";
import { afterWords, markSent } from "./sent";

const recordsSheets = (questions: FormQuestion[]) => questions.find((q) => q.prompt.startsWith("On whose behalf"));

const numeric = (type: string) => type === "number" || type === "currency";

const problemOf = (q: FormQuestion, draft: Draft) => {
  if (unsendable(q)) return q.required ? "This question needs a photo or file, which cannot be sent from here yet" : "";
  if (!filled(q, draft)) return q.required ? "This question needs an answer" : "";
  if (numeric(q.answer_type) && !Number.isFinite(Number(given(q, draft).text.trim()))) return "Enter a number";
  return "";
};

export function StepPage({ steps = mcpStepsClient, publisher }: { steps?: StepsClient; publisher?: PublishClient }) {
  const navigate = useNavigate();
  const { stepId = "" } = useParams();
  const [params] = useSearchParams();
  const order = params.get("order") ?? "";
  const [attempt, setAttempt] = useState(0);
  const loaded = useLoad(() => steps.available(), `step:${stepId}:${order}:${attempt}`);
  const draftKey = stepDraftKey(stepId, order);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(draftKey));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [edits, setEdits] = useState<Edits>({});
  const [refusal, setRefusal] = useState("");
  const [refusedFor, setRefusedFor] = useState<SendRefusal | "">("");
  const [sendKey, setSendKey] = useState(newSendKey);
  const [sheets, setSheets] = useState(0);
  const [resting, setResting] = useState(false);
  const [recorded, setRecorded] = useState({ orderId: "", keptOrderId: "", after: "" });
  const step = loaded.state === "ready" ? loaded.data.find((s) => s.id === stepId && s.orderId === order) : undefined;
  const back = () => navigate(doSomethingBackPath());

  if (loaded.state === "loading") {
    return (
      <Shell title="" onBack={back}>
        <LoadingLine />
      </Shell>
    );
  }
  if (loaded.state === "error") {
    return (
      <Shell title="" onBack={back}>
        <LoadFailed words="This task could not be opened." onRetry={() => setAttempt(attempt + 1)} />
      </Shell>
    );
  }
  if (!step) {
    return (
      <Shell title="" onBack={back}>
        <EmptyCard words="This task has closed." />
      </Shell>
    );
  }

  const questions = formQuestionsOf(step);
  const change = (id: string, patch: Partial<Given>) => {
    const next = { ...draft, [id]: { ...given(questions.find((q) => q.id === id)!, draft), ...patch } };
    setDraft(next);
    saveDraft(draftKey, next);
    setProblems((p) => ({ ...p, [id]: "" }));
  };
  const send = async () => {
    const found = Object.fromEntries(questions.map((q) => [q.id, problemOf(q, draft)]));
    setProblems(found);
    if (Object.values(found).some(Boolean)) return;
    setStatus("sending");
    setRefusal("");
    setRefusedFor("");
    try {
      const answers = { ...answersOf(questions, draft), ...amendmentsOf(step.earlier, edits) };
      const refs = placeRefsOf(questions, draft);
      const another = sheets > 0 ? { orderId: recorded.orderId } : undefined;
      const reply = await (Object.keys(refs).length > 0
        ? steps.submit(step, answers, sendKey, another, refs)
        : another
          ? steps.submit(step, answers, sendKey, another)
          : steps.submit(step, answers, sendKey));
      clearDraft(draftKey);
      const after = afterWords(reply);
      if (!recordsSheets(questions)) {
        markSent({ id: step.id, orderId: step.orderId || reply.orderId, title: step.formName || step.title, after });
        navigate(doSomethingBackPath());
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
    navigate(doSomethingBackPath());
  };

  if (resting) {
    return (
      <Shell title={step.formName || step.title} sub={step.workflowName || undefined} onBack={back}>
        <Card>
          <p>Sheets recorded: {sheets}</p>
          <Button onClick={addAnotherSheet}>Add another sheet</Button>
          <Button kind="primary" onClick={finished}>Finished</Button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell title={step.formName || step.title} sub={step.workflowName || undefined} onBack={back}>
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
