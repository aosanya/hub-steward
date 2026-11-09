import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { backlogsHomePath } from "../backlogs/paths";
import { useLoad } from "../forms/useLoad";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { StepsEditor } from "./StepsEditor";
import { draftProblem, heldWords, type DraftStep } from "./stepsDraft";
import { mcpBacklogManageClient } from "./api";
import { refusalWords, type BacklogDetail, type BacklogManageClient } from "./types";
import { useMayManage } from "./useMayManage";

function Form({ client, backlog }: { client: BacklogManageClient; backlog: BacklogDetail }) {
  const navigate = useNavigate();
  const [name, setName] = useState(backlog.name);
  const [steps, setSteps] = useState<DraftStep[]>(backlog.steps);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const held = backlog.steps.reduce((total, step) => total + step.held, 0);
  const holding = held > 0;
  const back = () => navigate(backlogsHomePath());

  useEffect(() => {
    setName(backlog.name);
    setSteps(backlog.steps);
  }, [backlog]);

  const attempt = async (act: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await act();
      back();
    } catch (error) {
      setProblem(refusalWords(error, fallback));
      setBusy(false);
    }
  };

  const save = () => {
    const found = draftProblem(name, steps);
    setProblem(found);
    if (found === "") attempt(() => client.save(backlog.id, name.trim(), steps), "The backlog could not be saved. Try again.");
  };

  return (
    <>
      <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <StepsEditor steps={steps} onChange={setSteps} showHeld />
      {problem ? <p className="ferr" role="alert">{problem}</p> : null}
      <Button kind="primary" onClick={save} disabled={busy}>
        Save
      </Button>
      {confirming ? (
        <>
          <p className="ferr" role="alert">{`Delete ${backlog.name}?`}</p>
          <Button kind="danger" onClick={() => attempt(() => client.remove(backlog.id), "The backlog could not be deleted. Try again.")} disabled={busy}>
            Delete
          </Button>
          <Button onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
        </>
      ) : (
        <Button kind="danger" onClick={() => setConfirming(true)} disabled={busy || holding}>
          Delete the backlog
        </Button>
      )}
      {holding ? <p className="sub">{`It still holds ${heldWords(held)}.`}</p> : null}
      <p className="sub">A step that holds issues cannot be removed, and a backlog that holds issues cannot be deleted.</p>
    </>
  );
}

export function EditBacklogScreen({ client = mcpBacklogManageClient }: { client?: BacklogManageClient }) {
  const navigate = useNavigate();
  const { backlogId = "" } = useParams();
  const may = useMayManage(client);
  const backlog = useLoad(() => client.read(backlogId), `edit-backlog:${backlogId}`);
  const title = backlog.state === "ready" ? `Edit ${backlog.data.name}` : "Edit a backlog";
  return (
    <Shell title={title} onBack={() => navigate(backlogsHomePath())}>
      {may.state === "loading" || backlog.state === "loading" ? <LoadingLine /> : null}
      {may.state === "error" || backlog.state === "error" ? <LoadFailed words="The backlog could not be loaded." /> : null}
      {may.state === "ready" && !may.data ? <EmptyCard words="Your role cannot change backlogs." /> : null}
      {may.state === "ready" && may.data && backlog.state === "ready" ? <Form client={client} backlog={backlog.data} /> : null}
    </Shell>
  );
}
