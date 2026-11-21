import { useLoad } from "../../features/forms/useLoad";
import { ListRow } from "../../shared/ui/ListRow";
import { Section } from "../../shared/ui/Section";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { rowTitleOf, type DeclaredRecord, type DeclaredRow } from "../menu/declaredRecord";
import { EditAct } from "../menu/RecordEditAct";
import { loadPeople } from "../menu/RecordRowForm";

type Props = { record: DeclaredRecord; row: DeclaredRow; position?: number; editTo?: string };

const noAnswer = "—";

const wordsOf = (answer: string, names: Map<string, string> | null, people: boolean) => {
  if (answer === "") return noAnswer;
  return people ? (names?.get(answer) ?? answer) : answer;
};

export function HomeRowFacts({ record, row, position = 1, editTo }: Props) {
  const asksForPeople = record.questions.some((question) => question.optionsFrom === "members");
  const people = useLoad(async () => (asksForPeople ? new Map((await loadPeople()).map((choice) => [choice.value, choice.label])) : null), `home-row-people:${openAgencyId()}:${asksForPeople}`);
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
          foot={editTo ? <EditAct to={editTo} /> : null}
          rows={record.questions.map((question) => <ListRow key={question.prompt} title={question.prompt} meta={wordsOf(row.answers[question.prompt] ?? "", names, question.optionsFrom === "members")} />)}
        />
      </div>
    </div>
  );
}
