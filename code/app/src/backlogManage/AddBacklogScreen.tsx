import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { backlogsHomePath } from "../backlogs/paths";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { EmptyCard, LoadFailed, LoadingLine } from "../ui/LoadState";
import { Shell } from "../ui/Shell";
import { StepsEditor } from "./StepsEditor";
import { draftProblem, type DraftStep } from "./stepsDraft";
import { mcpBacklogManageClient } from "./api";
import { refusalWords, type BacklogManageClient } from "./types";
import { useMayManage } from "./useMayManage";

export function AddBacklogScreen({ client = mcpBacklogManageClient }: { client?: BacklogManageClient }) {
  const navigate = useNavigate();
  const may = useMayManage(client);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const back = () => navigate(backlogsHomePath());

  const create = async () => {
    const found = draftProblem(name, steps);
    setProblem(found);
    if (found !== "") return;
    setSaving(true);
    try {
      await client.create(name.trim(), steps.map((step) => step.name.trim()));
      back();
    } catch (error) {
      setProblem(refusalWords(error, "The backlog could not be created. Try again."));
      setSaving(false);
    }
  };

  return (
    <Shell title="Add a backlog" onBack={back}>
      {may.state === "loading" ? <LoadingLine /> : null}
      {may.state === "error" ? <LoadFailed words="The backlogs could not be loaded." /> : null}
      {may.state === "ready" && !may.data ? <EmptyCard words="Your role cannot change backlogs." /> : null}
      {may.state === "ready" && may.data ? (
        <>
          <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <StepsEditor steps={steps} onChange={setSteps} showHeld={false} />
          <p className="sub">A new backlog is seen only by the Product owner group until you give another group access.</p>
          {problem ? <p className="ferr" role="alert">{problem}</p> : null}
          <Button kind="primary" onClick={create} disabled={saving}>
            Create the backlog
          </Button>
        </>
      ) : null}
    </Shell>
  );
}
