import type { ReactNode } from "react";
import { ListRow } from "../../shared/ui/ListRow";
import { Section } from "../../shared/ui/Section";

export type Fact = [label: string, value: string];

export function FactsCard({ word, facts, foot }: { word: string; facts: Fact[]; foot?: ReactNode }) {
  const shown = facts.filter(([, value]) => value !== "");
  return <Section word={word} plain foot={foot} rows={shown.map(([label, value]) => <ListRow key={label} title={label} meta={value} />)} />;
}
