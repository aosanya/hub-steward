import type { ReactNode } from "react";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import { SectionGo } from "../residents/SectionAct";
import { manageCouncil, type Item, text } from "./councilData";
import { councilPaths } from "./paths";
import type { EditKind } from "./councilRecords";

export function CouncilHead({ name, line }: { name: string; line?: string }) {
  return (
    <div className="title-block">
      <h1 className="person-name">{name}</h1>
      {line ? <p className="quiet-line">{line}</p> : null}
    </div>
  );
}

export function CouncilPage({ name, line, children }: { name: string; line?: string; children: ReactNode }) {
  return (
    <div className="person-page">
      <CouncilHead name={name} line={line} />
      <div className="sections">{children}</div>
    </div>
  );
}

export const editPath = (kind: EditKind, id: string) => councilPaths.edit.path({ kind, id });

export const EditAct = ({ kind, id, act = "Edit", permission = manageCouncil }: { kind: EditKind; id: string; act?: string; permission?: string }) => (
  <SectionGo permission={permission} act={act} to={editPath(kind, id)} />
);

export function DetailCard({ word, item, rows, kind, permission }: { word: string; item: Item; rows: [string, string][]; kind: EditKind; permission?: string }) {
  const shown = rows.filter(([, value]) => value !== "");
  return <Section word={word} plain rows={shown.map(([label, value]) => <ListRow key={label} title={label} meta={value} />)} foot={<EditAct kind={kind} id={text(item, "id")} permission={permission} />} />;
}
