import { useState } from "react";
import { useLoad } from "../forms/useLoad";
import { openAgencyId } from "../agency/open";
import { listPeople, namesOf, type Names } from "../people/api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { TextArea } from "../ui/TextArea";
import "./issueLog.css";
import type { NotesClient } from "./api";
import { linkOf, noteTime, type IssueNote } from "./issueNotes";

const noNames: Names = new Map();

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
      {note.text.split(/\n{2,}/).map((paragraph, at) => (
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
  const notes = useLoad(() => client.notes(issueId), `notes:${openAgencyId()}:${issueId}:${version}`);
  const people = useLoad(() => listPeople().then(namesOf, () => noNames), `notes-people:${openAgencyId()}`);
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
    <Card title="Log" collapsible defaultOpen={false} flush>
      {notes.state === "ready" && held.length === 0 ? <p className="log-none">Nothing logged yet.</p> : null}
      {notes.state === "error" ? <p className="log-none" role="alert">The Log could not be loaded.</p> : null}
      {held.map((note) => (
        <Entry key={note.id} note={note} names={names} />
      ))}
      <div className="log-add">
        <TextArea label="Add a note" value={text} onChange={(event) => setText(event.target.value)} />
        {failed ? <p className="ferr" role="alert">The note could not be added.</p> : null}
        <Button disabled={text.trim() === ""} onClick={add}>
          Add
        </Button>
      </div>
    </Card>
  );
}
