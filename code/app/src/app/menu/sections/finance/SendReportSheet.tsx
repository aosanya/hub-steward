import { useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { SearchSelect, type Choice } from "../../../../shared/ui/SearchSelect";
import { Sheet } from "../../../../shared/ui/Sheet";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";
import { personNameOf } from "../residents/personName";
import { text, type Item } from "./financeData";

const raiseTool = "comm_notification_raise";

const loadPeople = async (): Promise<Choice[]> =>
  (itemsOf(await callTool("", "actor_list_actors")) as Item[]).flatMap((person) => {
    const name = personNameOf(person);
    return typeof person.id === "string" && name !== "" ? [{ value: person.id, label: name }] : [];
  });

type Props = { report: Item; onClose: () => void };

export function SendReportSheet({ report, onClose }: Props) {
  const people = useLoad(loadPeople, `send-report-people:${openAgencyId()}`);
  const choices = people.state === "ready" ? people.data : [];
  const [person, setPerson] = useState("");
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState("");
  const [sentTo, setSentTo] = useState("");
  const send = async () => {
    setSending(true);
    setRefused("");
    try {
      await callTool("", raiseTool, {
        recipient_id: person,
        category: "report",
        event: "report_handed_over",
        subject_kind: "report",
        subject_id: text(report, "id"),
        names: Object.fromEntries(["name", "period", "planned", "spent", "difference"].map((key) => [key, text(report, key)])),
      });
      setSentTo(choices.find((choice) => choice.value === person)?.label ?? "");
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setSending(false);
    }
  };
  return (
    <Sheet title="Share" onClose={onClose}>
      {sentTo ? (
        <>
          <p>Sent to {sentTo}</p>
          <Button kind="primary" onClick={onClose}>Close</Button>
        </>
      ) : (
        <>
          <SearchSelect label="Person" choices={choices} value={person} onChange={setPerson} />
          {refused ? <LoadFailed words={refused} /> : null}
          <Button kind="primary" disabled={sending || person === ""} onClick={send}>Send</Button>
        </>
      )}
    </Sheet>
  );
}
