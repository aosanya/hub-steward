import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { FormQuestion } from "../../forms/api";
import { useForms } from "../../forms/context";
import { useLoad } from "../../forms/useLoad";
import { routes } from "../../routes";
import { BottomBar } from "../../ui/BottomBar";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyCard, LoadFailed, LoadingLine } from "../../ui/LoadState";
import { QuestionInput } from "../../forms/QuestionInput";
import { ListRow, Rows } from "../../ui/ListRow";
import { Shell } from "../../ui/Shell";
import { clearDraft, filled, given, loadDraft, saveDraft, shown, threadLines, toAnswers, type Draft, type Given } from "./answers";

type Step = number | "review";

export function AnswerPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const title: string = location.state?.title ?? "Form";
  const standing: boolean = Boolean(location.state?.standing);
  const forms = useForms();
  const go = useNavigate();
  const loaded = useLoad(() => forms.questions(id), `q-${id}`);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(id));
  const [step, setStep] = useState<Step>(0);
  const [missing, setMissing] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; message: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [lines, setLines] = useState<string[]>([]);

  const set = (qid: string, patch: Partial<Given>) =>
    setDraft((d) => {
      const next = { ...d, [qid]: { ...(d[qid] ?? { text: "", options: [] }), ...patch } };
      saveDraft(id, next);
      return next;
    });

  const submit = async (questions: FormQuestion[]) => {
    setStatus("sending");
    try {
      await forms.submit(id, toAnswers(questions, draft));
      setLines(threadLines(questions, draft));
      clearDraft(id);
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  };

  if (status === "sent" && standing) {
    return (
      <Shell title={title} sub="Your thread · with the agent" onBack={() => go(routes.forms.path())}>
        <Card>
          <p className="meta">You</p>
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Card>
        <Button kind="primary" onClick={() => go(routes.forms.path())}>Back to forms</Button>
      </Shell>
    );
  }

  if (status === "sent") {
    return (
      <Shell title="Form sent">
        <EmptyCard words="Your answers were sent" />
        <Button kind="primary" onClick={() => go(routes.forms.path())}>Back to forms</Button>
      </Shell>
    );
  }

  if (loaded.state !== "ready") {
    return (
      <Shell title={title} onBack={() => go(routes.forms.path())}>
        {loaded.state === "loading" ? <LoadingLine words="Loading questions" /> : <LoadFailed words="This form could not be loaded" />}
      </Shell>
    );
  }

  const questions = loaded.data;
  const total = questions.length;

  if (step === "review") {
    return (
      <Shell title="Review" sub={title} onBack={() => setStep(Math.max(total - 1, 0))}>
        <Rows>
          {questions.map((q, i) => (
            <ListRow key={q.id} title={`${i + 1} · ${q.prompt}`} meta={shown(q, draft)} end="Edit" onClick={() => setStep(i)} />
          ))}
        </Rows>
        {status === "failed" ? <p className="ferr">Your answers could not be sent. Try again.</p> : null}
        <BottomBar>
          <Button onClick={() => setStep(Math.max(total - 1, 0))}>Back</Button>
          <Button kind="primary" disabled={status === "sending"} onClick={() => submit(questions)}>Submit</Button>
        </BottomBar>
      </Shell>
    );
  }

  const q = questions[step];
  if (!q) {
    return (
      <Shell title={title} onBack={() => go(routes.forms.path())}>
        <EmptyCard words="This form has no questions" />
      </Shell>
    );
  }
  const next = () => {
    if (q.required && !filled(q, draft)) {
      setMissing(q.id);
      return;
    }
    setMissing(null);
    setOver(null);
    setStep(step + 1 >= total ? "review" : step + 1);
  };

  return (
    <Shell title={title} onBack={() => go(routes.forms.path())}>
      <p className="meta">Question {step + 1} of {total}</p>
      <QuestionInput q={q} value={given(q, draft)} error={over?.id === q.id ? over.message : missing === q.id ? "This question needs an answer" : undefined}
        onChange={(patch, message) => {
          setOver(message ? { id: q.id, message } : null);
          set(q.id, patch);
        }}
      />
      <p className="meta">Saved on this device</p>
      <BottomBar>
        <Button onClick={() => (step === 0 ? go(routes.forms.path()) : setStep(step - 1))}>Back</Button>
        <Button kind="primary" onClick={next}>Next</Button>
      </BottomBar>
    </Shell>
  );
}
