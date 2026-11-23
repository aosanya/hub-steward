import type { ReactNode } from "react";
import { useLoad } from "../../features/forms/useLoad";
import { ListRow } from "../../shared/ui/ListRow";
import { Section } from "../../shared/ui/Section";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { rowTitleOf, type DeclaredRecord, type DeclaredRow } from "../menu/declaredRecord";
import { actorLabels } from "../menu/sections/settings/auditNames";
import { unnamedPerson } from "../menu/sections/settings/personLabel";

type Props = { record: DeclaredRecord; row: DeclaredRow; position?: number; foot?: ReactNode };

const noAnswer = "—";

const isPerson = (question: { optionsFrom: string }) => question.optionsFrom === "members";

const wordsOf = (answer: string, names: Map<string, string> | null, people: boolean) => {
  if (answer === "") return noAnswer;
  if (!people) return answer;
  return names === null ? "" : (names.get(answer) ?? unnamedPerson);
};

export function HomeRowFacts({ record, row, position = 1, foot }: Props) {
  const asked = [...new Set(record.questions.filter(isPerson).map((question) => row.answers[question.prompt] ?? "").filter((answer) => answer !== ""))];
  const people = useLoad(() => actorLabels(asked), `home-row-people:${openAgencyId()}:${asked.join(",")}`);
  const names = people.state === "ready" ? people.data : null;
  return (
    <div className="person-page">
      <div className="title-block">
        <h1 className="person-name">{rowTitleOf(record, row, position)}</h1>
      </div>
      <div className="sections">
        <Section
          word={record.name}
          plain
          all
          counted={false}
          foot={foot}
          rows={record.questions.map((question) => <ListRow key={question.prompt} title={question.prompt} meta={wordsOf(row.answers[question.prompt] ?? "", names, isPerson(question))} />)}
        />
      </div>
    </div>
  );
}
