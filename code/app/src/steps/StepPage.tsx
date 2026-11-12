import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { FormQuestion } from "../forms/api";
import { QuestionInput } from "../forms/QuestionInput";
import { useLoad } from "../forms/useLoad";
import { clearDraft, filled, given, loadDraft, saveDraft, stepDraftKey, type Draft, type Given } from "../pages/forms/answers";
import { doSomethingBackPath } from "../routes";
import { BottomBar } from "../ui/BottomBar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { openAgencyId } from "../agency/open";
import { ongoingTab, startTab, tabPathIn } from "../tabs";
import { mcpStepsClient, newSendKey, StepRefused, refusalWords, type SendRefusal, type StepsClient } from "./api";
import { answersOf, formQuestionsOf, unsendable } from "./questions";
import { afterWords, markSent } from "./sent";

const numeric = (type: string) => type === "number" || type === "currency";

const problemOf = (q: FormQuestion, draft: Draft) => {
  if (unsendable(q)) return q.required ? "This question needs a photo or file, which cannot be sent from here yet" : "";
  if (!filled(q, draft)) return q.required ? "This question needs an answer" : "";
  if (numeric(q.answer_type) && !Number.isFinite(Number(given(q, draft).text.trim()))) return "Enter a number";
  return "";
};

export function StepPage({ steps = mcpStepsClient }: { steps?: StepsClient }) {
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
  const [refusal, setRefusal] = useState("");
  const [refusedFor, setRefusedFor] = useState<SendRefusal | "">("");
  const [sendKey] = useState(newSendKey);
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
      const reply = await steps.submit(step, answersOf(questions, draft), sendKey);
      clearDraft(draftKey);
      markSent({ id: step.id, orderId: step.orderId || reply.orderId, title: step.formName || step.title, after: afterWords(reply) });
      navigate(doSomethingBackPath());
    } catch (e) {
      setRefusedFor(e instanceof StepRefused ? e.reason : "failed");
      setRefusal(e instanceof StepRefused ? e.message : refusalWords.failed);
      setStatus("idle");
    }
  };

  return (
    <Shell title={step.formName || step.title} sub={step.workflowName || undefined} onBack={back}>
      <Card>
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
          {status === "sending" ? "Sending" : "Send"}
        </Button>
      </BottomBar>
    </Shell>
  );
}
