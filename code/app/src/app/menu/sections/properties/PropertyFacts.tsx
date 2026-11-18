import { ListRow } from "../../../../shared/ui/ListRow";
import { Section } from "../../../../shared/ui/Section";
import type { ReactNode } from "react";

type Fact = [label: string, value: string];

export function PropertyFacts({ word, facts, foot }: { word: string; facts: Fact[]; foot?: ReactNode }) {
  const rows = facts.filter(([, value]) => value !== "").map(([label, value]) => <ListRow key={label} title={label} meta={value} />);
  return <Section word={word} plain foot={foot} empty={{ words: "Nothing on file yet." }} rows={rows} />;
}
