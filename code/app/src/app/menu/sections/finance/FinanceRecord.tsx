import { useState, type ReactNode } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { useChatAboutSubject } from "../residents/SubjectChat";
import type { ChatAbout } from "../../../chatAbout";
import { text, type Item } from "./financeData";

export function FinanceHead({ name, line }: { name: string; line: string }) {
  return (
    <div className="title-block">
      <h1 className="person-name">{name}</h1>
      {line ? <p className="quiet-line">{line}</p> : null}
    </div>
  );
}

export function FactsCard({ word, item, facts, foot }: { word: string; item: Item; facts: [string, string][]; foot?: ReactNode }) {
  const rows = facts.filter(([, key]) => text(item, key) !== "").map(([label, key]) => <ListRow key={label} title={label} meta={text(item, key)} />);
  return <Section word={word} plain rows={rows} foot={foot} />;
}

export function EditAct({ permission, onEdit }: { permission: string; onEdit: () => void }) {
  const may = useMay(permission);
  if (!may) return null;
  return <button type="button" className="sec-act" onClick={onEdit}>Edit</button>;
}

export function ActButton({ permission, label, busy, onAct }: { permission: string; label: string; busy?: boolean; onAct: () => void }) {
  const may = useMay(permission);
  if (!may) return null;
  return <button type="button" className="sec-act" disabled={busy} onClick={onAct}>{label}</button>;
}

export function useFinanceEdit() {
  const [editing, setEditing] = useState(false);
  return { editing, start: () => setEditing(true), stop: () => setEditing(false) };
}

export function ChatAboutFinance({ about, back }: { about: ChatAbout; back: string }) {
  useChatAboutSubject(about, back);
  return null;
}
