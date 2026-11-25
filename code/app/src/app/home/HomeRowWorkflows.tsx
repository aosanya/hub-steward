import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { ListRow } from "../../shared/ui/ListRow";
import { Section } from "../../shared/ui/Section";
import type { HomeFacts } from "./homeFacts";
import { stepPathOf, type StepOrigin } from "./homeWorkflows";

type Props = { facts: HomeFacts; recordKey: string; rowId: string; from: StepOrigin["from"]; landing: string };

export function HomeRowWorkflows({ facts, recordKey, rowId, from, landing }: Props) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const mine = facts.subjectSteps.filter((step) => step.subjectRecord === recordKey);
  return (
    <Section
      word={words.homeWorkflows}
      plain
      all
      collapsed
      rows={mine.map((step) => <ListRow key={step.id} title={step.workflowName || step.title} end="›" onClick={() => navigate(stepPathOf(step, rowId), { state: { from, landing } })} />)}
    />
  );
}
