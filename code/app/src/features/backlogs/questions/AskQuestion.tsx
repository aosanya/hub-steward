import { useState } from "react";
import { useLoad } from "../../forms/useLoad";
import { useLanguage } from "../../../shared/language/language";
import { roleKey } from "../../../shared/wakala/agencyRoles";
import { openAgencyId } from "../../../shared/wakala/openAgency";
import { BottomBar } from "../../../shared/ui/BottomBar";
import { Button } from "../../../shared/ui/Button";
import { ChoiceGroup, ChoiceRow } from "../../../shared/ui/ChoiceRow";
import { Chip } from "../../../shared/ui/Chip";
import { Field } from "../../../shared/ui/Field";
import { Segmented } from "../../../shared/ui/Segmented";
import { Sheet } from "../../../shared/ui/Sheet";
import { TextArea } from "../../../shared/ui/TextArea";
import type { QuestionsClient } from "./types";
import "./questions.css";

type Props = { issueId: string; tags: string[]; client: QuestionsClient; onAsked: () => void; onClose: () => void };

const mostAnswers = 5;
const priorities = ["P1", "P2", "P3"].map((id) => ({ id, label: id }));

export function AskQuestion({ issueId, tags, client, onAsked, onClose }: Props) {
  const { words } = useLanguage();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("P2");
  const [role, setRole] = useState("");
  const [answers, setAnswers] = useState(["", ""]);
  const [recommended, setRecommended] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const found = useLoad(async () => (client.roles ? client.roles() : []), `ask-roles:${openAgencyId()}`);
  const named = answers.map((text) => text.trim());
  const chosen = recommended !== null && named[recommended] !== "" ? recommended : null;
  const ready = title.trim() !== "" && role !== "" && (chosen === null || reason.trim() !== "") && !busy;
  const options = named.flatMap((text, index) => (text === "" ? [] : [{ text, recommended: index === chosen, reason: index === chosen ? reason.trim() : "" }]));
  const ask = () => {
    setBusy(true);
    setFailed(false);
    client.ask!({ title: title.trim(), body: body.trim(), priority, targetRole: role, options, tags, issueId }).then(
      () => {
        setBusy(false);
        onAsked();
      },
      () => {
        setBusy(false);
        setFailed(true);
      },
    );
  };
  const roles = found.state === "ready" ? found.data : [];
  return (
    <Sheet title={words.questionAsk} onClose={onClose}>
      <div className="askform">
        <Field label={words.questionFieldQuestion} placeholder={words.questionQuestionPlaceholder} value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextArea label={words.rbWhyQuestion} placeholder={words.questionWhyPlaceholder} rows={2} value={body} onChange={(event) => setBody(event.target.value)} />
        <div className="field">
          <span className="flabel">{words.rbRowPriority}</span>
          <Segmented items={priorities} current={priority} onChange={setPriority} label={words.rbRowPriority} />
        </div>
        <ChoiceGroup label={words.questionFor} error={found.state === "ready" && title.trim() !== "" && role === "" ? words.questionRoleMissing : undefined}>
          {roles.map((one) => (
            <ChoiceRow key={one.id} type="radio" name="question-for" label={one.name} checked={role === roleKey(one)} onChange={() => setRole(roleKey(one))} />
          ))}
          {found.state === "error" ? <p className="ferr">{words.questionRolesFailed}</p> : null}
          <p className="meta">{words.questionForHelp}</p>
        </ChoiceGroup>
        <div className="field">
          <span className="flabel">{words.questionAnswersOffer}</span>
          <div className="optedit">
            {answers.map((text, index) => (
              <div className="optrow" key={index}>
                <div className="input">
                  <input type="text" placeholder={words.questionAnswerPlaceholder} value={text} onChange={(event) => setAnswers(answers.map((one, at) => (at === index ? event.target.value : one)))} />
                </div>
                <Chip pressed={chosen === index} onClick={() => setRecommended(recommended === index ? null : index)}>{words.questionRecommend}</Chip>
              </div>
            ))}
            {answers.length < mostAnswers ? (
              <Button onClick={() => setAnswers([...answers, ""])}>{words.questionAddAnswer}</Button>
            ) : null}
          </div>
          {chosen !== null ? <Field label={words.questionReasonLabel} value={reason} onChange={(event) => setReason(event.target.value)} /> : null}
          <p className="meta">{words.questionOffersNote}</p>
        </div>
        {failed ? <p className="ferr" role="alert">{words.questionAskFailed}</p> : null}
      </div>
      <BottomBar>
        <Button onClick={onClose}>{words.questionCancel}</Button>
        <Button kind="primary" disabled={!ready} onClick={ask}>{words.questionAskButton}</Button>
      </BottomBar>
    </Sheet>
  );
}
