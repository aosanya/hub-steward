import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../../app/Shell";
import { loadGroupChoices } from "../../app/menu/groupsOfType";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
import { LoadFailed } from "../../shared/ui/LoadState";
import { SearchSelect } from "../../shared/ui/SearchSelect";
import { openAgencyId } from "../../shared/wakala/openAgency";
import { useLoad } from "../forms/useLoad";
import { openQuestion } from "./api";
import { pollsPaths } from "./routePaths";

const firstChoices = 2;

const mostChoices = 6;

const defaultDays = "7";

const wholeDays = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : 0);

export function AskQuestionScreen() {
  const navigate = useNavigate();
  const groups = useLoad(loadGroupChoices, `ask-groups:${openAgencyId()}`);
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState<string[]>(Array(firstChoices).fill(""));
  const [groupId, setGroupId] = useState("");
  const [days, setDays] = useState(defaultDays);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [refused, setRefused] = useState("");
  const written = choices.map((choice) => choice.trim()).filter((choice) => choice !== "");
  const ready = question.trim() !== "" && written.length >= firstChoices && groupId !== "" && wholeDays(days) > 0;
  const setChoice = (index: number, value: string) => setChoices((was) => was.map((choice, at) => (at === index ? value : choice)));
  const open = async () => {
    setOpening(true);
    setRefused("");
    try {
      await openQuestion({ question: question.trim(), choices: written, groupId, days: wholeDays(days) });
      setOpened(true);
    } catch (error) {
      setRefused((error as Error).message);
    } finally {
      setOpening(false);
    }
  };
  const back = () => navigate(pollsPaths.question.path());
  return (
    <Shell title="Ask a question" titleUnder backLabel="Question" onBack={back} tabless>
      {opened ? (
        <>
          <p role="status">Your question is open.</p>
          <Button kind="primary" onClick={back}>Back to the question</Button>
        </>
      ) : (
        <>
          <Field label="Question" value={question} onChange={(event) => setQuestion(event.target.value)} />
          {choices.map((choice, index) => (
            <Field key={index} label={`Choice ${index + 1}`} value={choice} onChange={(event) => setChoice(index, event.target.value)} />
          ))}
          {choices.length < mostChoices ? <Button kind="quiet" onClick={() => setChoices((was) => [...was, ""])}>Add a choice</Button> : null}
          {groups.state === "error" ? <LoadFailed words="The groups could not be loaded." /> : null}
          <SearchSelect label="Goes to" choices={groups.state === "ready" ? groups.data : []} value={groupId} onChange={setGroupId} />
          <Field label="Open for" value={days} inputMode="numeric" unitAfter="days" onChange={(event) => setDays(event.target.value)} />
          {refused ? <LoadFailed words={refused} /> : null}
          <Button kind="primary" disabled={!ready || opening} onClick={open}>Open the question</Button>
        </>
      )}
    </Shell>
  );
}
