import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLoad } from "../../forms/useLoad";
import { openAgencyId } from "../../agency/open";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Chip } from "../../ui/Chip";
import { ListRow, Rows } from "../../ui/ListRow";
import { backState } from "../../ui/backTo";
import { addReferencePath, issuePath } from "../paths";
import { kindWords, type Reference, type ReferencesClient, type RepoClient } from "./api";
import { missingOf } from "./repoPaths";
import "./references.css";

const noneMissing = new Set<string>();

const kindLine = (one: Reference) => (one.repo ? `${one.repo} · ${kindWords[one.kind]}` : kindWords[one.kind]);

function Marks({ one, missing, onConfirm }: { one: Reference; missing: boolean; onConfirm: () => void }) {
  const waiting = one.source === "assistant" && !one.confirmed;
  return (
    <div className="refmeta">
      {one.source === "assistant" ? <Chip tone="info">Assistant proposed</Chip> : <Chip>Person</Chip>}
      {one.source === "assistant" && one.confirmed ? <Chip tone="success">Confirmed</Chip> : null}
      {missing ? <Chip tone="danger">Not found</Chip> : null}
      {waiting ? (
        <Button kind="primary" className="refconfirm" onClick={onConfirm}>
          Confirm
        </Button>
      ) : null}
    </div>
  );
}

function Entry({ one, missing, onOpenIssue, onConfirm, onRemove }: { one: Reference; missing: boolean; onOpenIssue: () => void; onConfirm: () => void; onRemove: () => void }) {
  const row = <ListRow title={one.target} meta={kindLine(one)} onClick={one.kind === "issue" ? onOpenIssue : undefined} end={one.kind === "issue" ? "›" : undefined} />;
  return (
    <div className={missing ? "refrow missing" : "refrow"}>
      <div className="refmain">
        {one.kind === "link" ? (
          <a className="reflink" href={one.target} target="_blank" rel="noreferrer">
            {row}
          </a>
        ) : (
          row
        )}
        <button type="button" className="refremove" aria-label="Remove" onClick={onRemove}>
          ×
        </button>
      </div>
      <Marks one={one} missing={missing} onConfirm={onConfirm} />
    </div>
  );
}

export function ReferencesCard({ issueId, client, repoClient }: { issueId: string; client: ReferencesClient; repoClient: RepoClient }) {
  const navigate = useNavigate();
  const here = useLocation();
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const scope = `${openAgencyId()}:${issueId}`;
  const loaded = useLoad(() => client.list(issueId), `references:${scope}:${version}`);
  const held = loaded.state === "ready" ? loaded.data : [];
  const checked = useLoad(() => missingOf(held, repoClient), `references-missing:${scope}:${held.map((one) => one.id).join(",")}`);
  const missing = checked.state === "ready" ? checked.data : noneMissing;
  const change = async (work: () => Promise<unknown>) => {
    setFailed(false);
    try {
      await work();
      setVersion((now) => now + 1);
    } catch {
      setFailed(true);
    }
  };
  const openIssue = async (one: Reference) => {
    const id = await client.findIssue(one.target).catch(() => null);
    if (id) navigate(issuePath(id), backState(here.pathname + here.search));
  };
  return (
    <Card title="References" collapsible flush>
      {loaded.state === "error" ? (
        <p className="ref-none" role="alert">
          The references could not be loaded.
        </p>
      ) : null}
      {loaded.state === "ready" && held.length === 0 ? <p className="ref-none">Nothing referenced yet.</p> : null}
      {held.length > 0 ? (
        <Rows>
          {held.map((one) => (
            <Entry
              key={one.id}
              one={one}
              missing={missing.has(one.id)}
              onOpenIssue={() => openIssue(one)}
              onConfirm={() => change(() => client.confirm(issueId, one.id))}
              onRemove={() => change(() => client.remove(issueId, one.id))}
            />
          ))}
        </Rows>
      ) : null}
      {failed ? (
        <p className="ferr ref-none" role="alert">
          That could not be done.
        </p>
      ) : null}
      <div className="ref-add">
        <Button to={addReferencePath(issueId)}>Add a reference</Button>
      </div>
    </Card>
  );
}
