import type { ReactNode } from "react";
import { useMay } from "../../../../features/agency/useMay";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { text, type Item } from "../staff/staffData";

export function ServiceHead({ title, status = "", line = "" }: { title: string; status?: string; line?: string }) {
  return (
    <div className="title-block">
      <h1 className="person-name">{title}</h1>
      {status || line ? (
        <p className="quiet-line">
          {status ? <span>{status}</span> : null}
          {status && line ? " · " : null}
          {line ? <span>{line}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export function ServiceAct({ label, onClick, disabled, quiet = false }: { label: string; onClick: () => void; disabled?: boolean; quiet?: boolean }) {
  return (
    <button type="button" className={quiet ? "sec-foot-item" : "sec-act"} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

export function ServiceEditAct({ permission, onEdit }: { permission: string; onEdit: () => void }) {
  return useMay(permission) ? <ServiceAct label="Edit" onClick={onEdit} /> : null;
}

export function ServiceDetails({ word, item, fields, foot }: { word: string; item: Item; fields: Record<string, string>; foot?: ReactNode }) {
  const rows = Object.entries(fields)
    .filter(([, key]) => text(item, key) !== "")
    .map(([label, key]) => <ListRow key={label} title={label} meta={text(item, key)} />);
  return <Section word={word} plain foot={foot} rows={rows} />;
}
