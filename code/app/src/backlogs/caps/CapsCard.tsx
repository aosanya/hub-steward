import { useEffect, useState } from "react";
import { useLoad } from "../../forms/useLoad";
import { openAgencyId } from "../../agency/open";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { dateTimeWords } from "../../ui/days";
import { Field } from "../../ui/Field";
import { mcpCapsClient, type CapsClient, type CapsReading } from "./api";
import { changeOf, droppedOwn, problemsIn, sentNothing, typedFrom, type Typed } from "./capsEdit";
import { linesOf, ownershipOf, type CapLine } from "./capsFigures";
import "./caps.css";

function Line({ line, fallsBack }: { line: CapLine; fallsBack: boolean }) {
  const className = ["cap-line", line.nearest ? "nearest" : "", line.passed ? "passed" : ""].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <span className="cap-label">{line.label}</span>
      <span className="cap-value">{line.figure}</span>
      <span className="cap-marks">
        {fallsBack ? <Chip>Default</Chip> : null}
        {line.nearest ? <Chip tone="accent">Nearest</Chip> : null}
        {line.passed ? <Chip tone="danger">Passed</Chip> : null}
        {line.paused ? <Chip>Paused, waiting for your answer</Chip> : null}
      </span>
      <span className="cap-bar" role="progressbar" aria-label={`${line.label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={line.percent}>
        <span className="cap-fill" style={{ width: `${line.percent}%` }} />
      </span>
      <span className="cap-percent">{line.percent}% used</span>
    </div>
  );
}

type EditProps = { reading: CapsReading; issueId: string; client: CapsClient; onSaved: (reading: CapsReading) => void; onClose: () => void };

function Editing({ reading, issueId, client, onSaved, onClose }: EditProps) {
  const [typed, setTyped] = useState<Typed>(() => typedFrom(reading));
  const [problems, setProblems] = useState<ReturnType<typeof problemsIn>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const type = (key: keyof Typed) => (event: { target: { value: string } }) => setTyped({ ...typed, [key]: event.target.value });
  const run = async (work: () => Promise<CapsReading>) => {
    setBusy(true);
    setFailed(false);
    try {
      onSaved(await work());
      onClose();
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };
  const useDefault = () => run(() => client.clear(issueId));
  const save = () => {
    const found = problemsIn(typed);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    const change = changeOf(typed);
    if (sentNothing(change)) return reading.own === null ? onClose() : useDefault();
    return run(async () => {
      if (droppedOwn(reading.own, change)) await client.clear(issueId);
      return client.set(issueId, change);
    });
  };
  return (
    <>
      <div className="cap-fields">
        <Field label="Input tokens" inputMode="numeric" value={typed.input} error={problems.input} onChange={type("input")} />
        <Field label="Output tokens" inputMode="numeric" value={typed.output} error={problems.output} onChange={type("output")} />
        <Field label="Runtime in minutes" inputMode="numeric" value={typed.minutes} error={problems.minutes} onChange={type("minutes")} />
        {failed ? (
          <p className="ferr" role="alert">
            The caps could not be saved.
          </p>
        ) : null}
      </div>
      <div className="cap-actions">
        <Button kind="primary" disabled={busy} onClick={save}>
          Save
        </Button>
        <Button disabled={busy} onClick={useDefault}>
          Use the default
        </Button>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </>
  );
}

const refreshMilliseconds = 15_000;

function updatedWords(reading: CapsReading) {
  const when = reading.used?.updatedAt ? dateTimeWords(reading.used.updatedAt) : null;
  return when === null ? null : `updated ${when}`;
}

export function CapsCard({ issueId, client = mcpCapsClient, running = false }: { issueId: string; client?: CapsClient; running?: boolean }) {
  const [saved, setSaved] = useState<CapsReading | null>(null);
  const [editing, setEditing] = useState(false);
  const loaded = useLoad(() => client.read(issueId), `caps:${openAgencyId()}:${issueId}`);
  const reading = saved ?? (loaded.state === "ready" ? loaded.data : null);
  useEffect(() => {
    if (!running || editing) return;
    const timer = setInterval(() => client.read(issueId).then(setSaved, () => undefined), refreshMilliseconds);
    return () => clearInterval(timer);
  }, [running, editing, issueId, client]);
  const updated = reading ? updatedWords(reading) : null;
  return (
    <Card title="Caps" collapsible defaultOpen={false} flush>
      {loaded.state === "error" && saved === null ? (
        <p className="cap-none" role="alert">
          The caps could not be read.
        </p>
      ) : null}
      {reading ? (
        editing ? (
          <Editing reading={reading} issueId={issueId} client={client} onSaved={setSaved} onClose={() => setEditing(false)} />
        ) : (
          <>
            {linesOf(reading).map((line) => (
              <Line key={line.key} line={line} fallsBack={reading.own !== null && !line.own} />
            ))}
            {updated ? <p className="cap-updated">{updated}</p> : null}
            <p className="cap-owner">{ownershipOf(reading)}</p>
            <div className="cap-actions">
              <Button onClick={() => setEditing(true)}>Edit</Button>
            </div>
          </>
        )
      ) : null}
    </Card>
  );
}
