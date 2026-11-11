import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { openAgencyId } from "../../agency/open";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { LoadingLine } from "../../ui/LoadState";
import { ListRow, Rows } from "../../ui/ListRow";
import { SearchBox } from "../../ui/SearchBox";
import { Shell } from "../../ui/Shell";
import { issuePath } from "../paths";
import { mcpReferencesClient, mcpRepoClient, type ReferenceKind, type ReferencesClient, type RepoClient } from "./api";
import { parentOf } from "./repoPaths";
import "./references.css";

type Step = { at: "kinds" } | { at: "repo"; kind: "file" | "folder" } | { at: "tree"; kind: "file" | "folder"; repo: string; path: string } | { at: "line"; kind: "issue" | "screen" | "link" };

const kindChoices: { kind: ReferenceKind; title: string; meta: string }[] = [
  { kind: "file", title: "File", meta: "Pick it from a repo" },
  { kind: "folder", title: "Folder", meta: "Pick it from a repo" },
  { kind: "issue", title: "Board row", meta: "Another issue, by its number" },
  { kind: "screen", title: "Screen or tool", meta: "Such as the Access screen or agency_list_mounts" },
  { kind: "link", title: "Website link", meta: "A URL" },
];

const lineLabels = { issue: "Issue number", screen: "Screen or tool name", link: "Website link" };

const chevron = "›";

type Submit = (kind: ReferenceKind, repo: string, target: string) => void;

function Kinds({ onChoose }: { onChoose: (kind: ReferenceKind) => void }) {
  return (
    <Rows>
      {kindChoices.map((one) => (
        <ListRow key={one.kind} title={one.title} meta={one.meta} end={chevron} onClick={() => onChoose(one.kind)} />
      ))}
    </Rows>
  );
}

function Repos({ repoClient, onChoose }: { repoClient: RepoClient; onChoose: (repo: string) => void }) {
  const [typed, setTyped] = useState("");
  const listed = useLoad(() => repoClient.repos(), `reference-repos:${openAgencyId()}`);
  const catalog = listed.state === "ready" ? listed.data : [];
  const wanted = typed.trim();
  const shown = catalog.filter((name) => name.toLowerCase().includes(wanted.toLowerCase()));
  const offerTyped = wanted !== "" && !catalog.includes(wanted);
  return (
    <>
      <SearchBox label="Find a repo" value={typed} onChange={setTyped} />
      <Rows>
        {shown.map((name) => (
          <ListRow key={name} title={name} end={chevron} onClick={() => onChoose(name)} />
        ))}
        {offerTyped ? <ListRow title={wanted} end={chevron} onClick={() => onChoose(wanted)} /> : null}
      </Rows>
    </>
  );
}

function TypedPath({ label, onAdd, kind, repo }: { label: string; onAdd: Submit; kind: "file" | "folder"; repo: string }) {
  const [path, setPath] = useState("");
  return (
    <>
      <p className="sub" role="status">
        The tree of {repo} could not be read.
      </p>
      <Field label={label} value={path} onChange={(event) => setPath(event.target.value)} />
      <Button kind="primary" disabled={path.trim() === ""} onClick={() => onAdd(kind, repo, path.trim())}>
        Add
      </Button>
    </>
  );
}

function Tree({ kind, repo, path, repoClient, onOpen, onAdd }: { kind: "file" | "folder"; repo: string; path: string; repoClient: RepoClient; onOpen: (path: string) => void; onAdd: Submit }) {
  const listed = useLoad(() => repoClient.entries(repo, path), `reference-tree:${openAgencyId()}:${repo}:${path}`);
  if (listed.state === "loading") return <LoadingLine />;
  if (listed.state === "error" || listed.data === null) return <TypedPath label={`Path in ${repo}`} onAdd={onAdd} kind={kind} repo={repo} />;
  const entries = listed.data.filter((entry) => entry.folder || kind === "file");
  return (
    <>
      <div className="crumb">{[repo, path].filter(Boolean).join("/")}</div>
      <Rows>
        {path ? <ListRow title=".." meta="Up one folder" onClick={() => onOpen(parentOf(path))} /> : null}
        {entries.map((entry) => (
          <ListRow key={entry.path} title={entry.name} meta={entry.folder ? "Folder" : "File"} onClick={() => (entry.folder ? onOpen(entry.path) : onAdd("file", repo, entry.path))} />
        ))}
      </Rows>
      {kind === "folder" && path ? (
        <Button onClick={() => onAdd("folder", repo, path)}>Use this folder</Button>
      ) : (
        <p className="sub">{kind === "file" ? "Tap a file to add it." : "Open a folder, then use it."}</p>
      )}
    </>
  );
}

function Line({ kind, onAdd }: { kind: "issue" | "screen" | "link"; onAdd: Submit }) {
  const [typed, setTyped] = useState("");
  return (
    <>
      <Field label={lineLabels[kind]} value={typed} onChange={(event) => setTyped(event.target.value)} />
      <Button kind="primary" disabled={typed.trim() === ""} onClick={() => onAdd(kind, "", typed.trim())}>
        Add
      </Button>
    </>
  );
}

const titleOf = (step: Step) => (step.at === "tree" ? step.repo : step.at === "repo" ? "Choose a repo" : step.at === "line" ? kindChoices.find((one) => one.kind === step.kind)?.title ?? "" : "Add a reference");

export function AddReferencePage({ client = mcpReferencesClient, repoClient = mcpRepoClient }: { client?: ReferencesClient; repoClient?: RepoClient }) {
  const navigate = useNavigate();
  const issueId = useParams().issueId ?? "";
  const [step, setStep] = useState<Step>({ at: "kinds" });
  const [failed, setFailed] = useState(false);
  const toIssue = () => navigate(issuePath(issueId));
  const choose = (kind: ReferenceKind) => setStep(kind === "file" || kind === "folder" ? { at: "repo", kind } : { at: "line", kind });
  const add: Submit = async (kind, repo, target) => {
    setFailed(false);
    try {
      await client.add(issueId, kind, repo, target);
      toIssue();
    } catch {
      setFailed(true);
    }
  };
  const back = step.at === "kinds" ? toIssue : step.at === "tree" ? () => setStep({ at: "repo", kind: step.kind }) : () => setStep({ at: "kinds" });
  const backLabel = step.at === "kinds" ? "Cancel" : step.at === "tree" ? "Repos" : "Kinds";
  return (
    <Shell title={titleOf(step)} onBack={back} backLabel={backLabel} tabless>
      {step.at === "kinds" ? <Kinds onChoose={choose} /> : null}
      {step.at === "repo" ? <Repos repoClient={repoClient} onChoose={(repo) => setStep({ at: "tree", kind: step.kind, repo, path: "" })} /> : null}
      {step.at === "tree" ? <Tree kind={step.kind} repo={step.repo} path={step.path} repoClient={repoClient} onOpen={(path) => setStep({ ...step, path })} onAdd={add} /> : null}
      {step.at === "line" ? <Line kind={step.kind} onAdd={add} /> : null}
      {failed ? (
        <p className="ferr" role="alert">
          That could not be added.
        </p>
      ) : null}
    </Shell>
  );
}
