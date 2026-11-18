import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import type { ChatAbout } from "../../../chatAbout";
import { useChatAboutSubject } from "../residents/SubjectChat";

export const itemParam = "item";

export const useChosenItem = () => useSearchParams()[0].get(itemParam) ?? undefined;

export const text = (item: Record<string, unknown>, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

export function ChatAboutItem({ about, back }: { about: ChatAbout; back: string }) {
  useChatAboutSubject(about.id === "" ? null : about, `${back}?${itemParam}=${about.id}`);
  return null;
}

export function RecordPage({ name, line, children }: { name: string; line?: string; children: ReactNode }) {
  return (
    <div className="person-page">
      <div className="title-block">
        <h1 className="person-name">{name}</h1>
        {line ? <p className="quiet-line">{line}</p> : null}
      </div>
      <div className="sections">{children}</div>
    </div>
  );
}

export type Fact = [label: string, value: string];

export function FactsCard({ word, facts, foot }: { word: string; facts: Fact[]; foot?: ReactNode }) {
  const shown = facts.filter(([, value]) => value !== "");
  return <Section word={word} plain foot={foot} rows={shown.map(([label, value]) => <ListRow key={label} title={label} meta={value} />)} />;
}
