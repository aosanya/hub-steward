import { useLanguage } from "../entry/language";
import { Chip } from "./Chip";
import { ageOf, ageWords } from "./age";
import { dateTimeWords } from "./days";

type Props = { created?: string; ended?: string; closed?: boolean; now?: number };

export function AgeBubble({ created, ended, closed = false, now = Date.now() }: Props) {
  const { words } = useLanguage();
  const age = ageOf(created, closed ? Date.parse(ended ?? "") : now);
  const createdText = created ? dateTimeWords(created) : null;
  if (age === null || createdText === null) return null;
  const finishedText = closed && ended ? dateTimeWords(ended) : null;
  const title = finishedText
    ? words.ageCreatedFinished.replace("{created}", createdText).replace("{finished}", finishedText)
    : words.ageCreated.replace("{created}", createdText);
  return <Chip title={title}>{ageWords(age, words)}</Chip>;
}
