import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/language/language";
import { SecAct } from "../menu/RecordEditAct";
import type { HomeFacts } from "./homeFacts";
import { rowStepOf, stepPathOf, type StepOrigin } from "./homeWorkflows";

type Props = { facts: HomeFacts; recordKey: string; rowId: string; from: StepOrigin["from"]; afterEdit: string; afterDelete: string };

export function HomeRowActs({ facts, recordKey, rowId, from, afterEdit, afterDelete }: Props) {
  const navigate = useNavigate();
  const { words } = useLanguage();
  const edit = rowStepOf(facts, recordKey, "edit");
  const remove = rowStepOf(facts, recordKey, "delete");
  if (!edit && !remove) return null;
  return (
    <>
      {edit ? <SecAct label={words.homeEdit} onClick={() => navigate(stepPathOf(edit, rowId), { state: { from, landing: afterEdit } })} /> : null}
      {remove ? <SecAct label={words.homeDelete} onClick={() => navigate(stepPathOf(remove, rowId), { state: { from, landing: afterDelete } })} /> : null}
    </>
  );
}
