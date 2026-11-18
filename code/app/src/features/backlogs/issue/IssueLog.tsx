import { useState } from "react";
import { useLoad } from "../../../features/forms/useLoad";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { listAgents, listPeople, namesOf, type Names } from "../../../features/people/api";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Chip } from "../../../shared/ui/Chip";
import { TextArea } from "../../../shared/ui/TextArea";
import "./issueLog.css";
import type { NotesClient } from "../shared/api";
import { linkOf, noteTime, shownText, type IssueNote } from "../shared/issueNotes";

const noNames: Names = new Map();

const loadNames = async (): Promise<Names> => {
  const named = new Map(await listPeople().then(namesOf, () => noNames));
  for (const agent of await listAgents().catch(() => [])) {
    if (agent.name === "") continue;
    for (const key of [agent.id, agent.agentId]) if (key !== "") named.set(key, agent.name);
  }
  return named;
};

function Links({ links }: { links: string[] }) {
  if (links.length === 0) return null;
  return (
    <div className="log-links">
      {links.map((raw) => {
        const { label, href } = linkOf(raw);
        return href ? (
          <a key={raw} className="log-link" href={href} target="_blank" rel="noreferrer">
            {label}
          </a>
        ) : (
          <span key={raw} className="log-link">
            {label}
          </span>
        );
      })}
    </div>
  );
}

function Entry({ note, names }: { note: IssueNote; names: Names }) {
  const name = names.get(note.author);
  return (
    <div className="log-entry">
      <div className="log-by">
        {name ? <b>{name}</b> : null}
        <Chip tone={note.kind === "worker" ? "info" : undefined}>{note.kind === "worker" ? "Worker" : "Person"}</Chip>
        <span>{noteTime(note.at)}</span>
      </div>
      {shownText(note, names).split(/\n{2,}/).map((paragraph, at) => (
        <p key={at}>{paragraph}</p>
      ))}
      <Links links={note.links} />
    </div>
  );
}

export function IssueLog({ issueId, client }: { issueId: string; client: NotesClient }) {
  const [version, setVersion] = useState(0);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const notes = useLoad(() => client.notes(issueId), `notes:${openAgencyId()}:${issueId}:${version}`);
  const people = useLoad(loadNames, `notes-people:${openAgencyId()}`);
  const names = people.state === "ready" ? people.data : noNames;
  const held = notes.state === "ready" ? notes.data : [];
  const add = async () => {
    setFailed(false);
    try {
      await client.addNote(issueId, text.trim());
      setText("");
      setVersion((now) => now + 1);
    } catch {
      setFailed(true);
    }
  };
  return (
    <Card
      title="Log"
      collapsible
      defaultOpen={false}
      flush
      footer={
        adding ? (
          <>
            <Button onClick={() => { setText(""); setFailed(false); setAdding(false); }}>Cancel</Button>
            <Button disabled={text.trim() === ""} onClick={add}>Add</Button>
          </>
        ) : (
          <Button onClick={() => setAdding(true)}>Add a note</Button>
        )
      }
    >
      {notes.state === "ready" && held.length === 0 ? <p className="log-none">Nothing logged yet.</p> : null}
      {notes.state === "error" ? <p className="log-none" role="alert">The Log could not be loaded.</p> : null}
      {held.map((note) => (
        <Entry key={note.id} note={note} names={names} />
      ))}
      {adding ? (
        <div className="log-add">
          <TextArea label="Add a note" value={text} onChange={(event) => setText(event.target.value)} />
          {failed ? <p className="ferr" role="alert">The note could not be added.</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
