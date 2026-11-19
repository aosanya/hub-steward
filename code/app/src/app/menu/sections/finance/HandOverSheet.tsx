import { useState } from "react";
import { useLoad } from "../../../../features/forms/useLoad";
import { useLanguage } from "../../../../shared/language/language";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { SearchSelect } from "../../../../shared/ui/SearchSelect";
import { Sheet } from "../../../../shared/ui/Sheet";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";
import { loadPersonIdChoices, loadRecipientChoices } from "../../referenceChoices";

const eventsToStaffOnly = ["payment_list_handed_over"];

const raiseTool = "comm_notification_raise";

const readSettingTool = "forms_catalog_setting_read";

const writeSettingTool = "forms_catalog_setting_write";

type Props = {
  title: string;
  category: string;
  event: string;
  subjectKind: string;
  subjectId: string;
  names: Record<string, string>;
  rememberAs?: string;
  onClose: () => void;
};

const rememberedPerson = async (key: string | undefined) => {
  if (!key) return "";
  const reply = (await callTool("", readSettingTool, { key })) as { value?: unknown } | null;
  return typeof reply?.value === "string" ? reply.value : "";
};

const rememberPerson = async (key: string | undefined, person: string) => {
  if (!key) return;
  try {
    await callTool("", writeSettingTool, { key, value: person });
  } catch {
    return;
  }
};

export function HandOverSheet({ title, category, event, subjectKind, subjectId, names, rememberAs, onClose }: Props) {
  const { words } = useLanguage();
  const staffOnly = eventsToStaffOnly.includes(event);
  const people = useLoad(() => (staffOnly ? loadRecipientChoices(event) : loadPersonIdChoices()), `hand-over-people:${openAgencyId()}:${staffOnly ? event : ""}`);
  const remembered = useLoad(() => rememberedPerson(rememberAs), `hand-over-chaser:${openAgencyId()}:${rememberAs ?? ""}`);
  const choices = people.state === "ready" ? people.data : [];
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState("");
  const [sentTo, setSentTo] = useState("");
  const kept = remembered.state === "ready" && choices.some((choice) => choice.value === remembered.data) ? remembered.data : "";
  const person = chosen ?? kept;
  const send = async () => {
    setSending(true);
    setRefused("");
    try {
      await callTool("", raiseTool, { recipient_id: person, category, event, subject_kind: subjectKind, subject_id: subjectId, names });
      setSentTo(choices.find((choice) => choice.value === person)?.label ?? "");
      await rememberPerson(rememberAs, person);
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSending(false);
    }
  };
  return (
    <Sheet title={title} onClose={onClose}>
      {sentTo ? (
        <>
          <p>Sent to {sentTo}</p>
          <Button kind="primary" onClick={onClose}>{words.close}</Button>
        </>
      ) : staffOnly && people.state === "ready" && choices.length === 0 ? (
        <p>No one holds a seat that receives this list yet.</p>
      ) : (
        <>
          <SearchSelect label="Person" choices={choices} value={person} onChange={setChosen} />
          {refused ? <LoadFailed words={refused} /> : null}
          <Button kind="primary" disabled={sending || person === ""} onClick={send}>Send</Button>
        </>
      )}
    </Sheet>
  );
}
