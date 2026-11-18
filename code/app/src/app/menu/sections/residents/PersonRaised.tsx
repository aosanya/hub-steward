import { useState } from "react";
import { useWord } from "../../../../features/agency/useWord";
import { useLoad } from "../../../../features/forms/useLoad";
import { dayWords } from "../../../../shared/ui/days";
import { Button } from "../../../../shared/ui/Button";
import { Field } from "../../../../shared/ui/Field";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { Sheet } from "../../../../shared/ui/Sheet";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";
import { issuePaths } from "../issues/paths";
import { listOf, text } from "../staff/staffData";
import { EmptyActCard } from "./EmptyActCard";
import { useOpenFromPanel } from "./useOpenFromPanel";

const loadRaised = (personId: string) => async () => {
  const items = await listOf("forms_catalog_raised_item_list_of_person", { raised_by: personId });
  return items
    .map((item) => ({ key: text(item, "id"), title: text(item, "title"), status: text(item, "status"), raisedAt: text(item, "created_at") }))
    .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
};

const raiseTitle = "Raise on their behalf";

function RaiseSheet({ personId, onClose, onRaised }: { personId: string; onClose: () => void; onRaised: () => void }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState("");
  const raise = async () => {
    setSaving(true);
    setRefused("");
    try {
      await callTool("", "forms_catalog_raised_item_file", { raised_by: personId, channel: "phone", title: title.trim(), topic: topic.trim(), address: address.trim() });
      onClose();
      onRaised();
    } catch (error) {
      setRefused(refusalWords(error));
      setSaving(false);
    }
  };
  return (
    <Sheet title={raiseTitle} onClose={onClose}>
      <Field label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <Field label="Topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
      <Field label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="primary" disabled={saving || title.trim() === ""} onClick={raise}>Raise</Button>
    </Sheet>
  );
}

export function PersonRaised({ id }: { id: string }) {
  const word = useWord("forms");
  const open = useOpenFromPanel();
  const [version, setVersion] = useState(0);
  const view = useLoad(loadRaised(id), `person-raised:${openAgencyId()}:${id}:${version}`);
  if (view.state === "error") return null;
  const raised = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>{word("Wishes and issues")}</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "ready" && raised.length === 0 ? (
        <EmptyActCard
          words="Nothing raised yet."
          permission="board.manage"
          act={raiseTitle}
          sheet={(close) => <RaiseSheet personId={id} onClose={close} onRaised={() => setVersion((was) => was + 1)} />}
        />
      ) : null}
      {raised.length > 0 ? (
        <Rows>
          {raised.map((item) => (
            <ListRow key={item.key} title={item.title} meta={`${item.status}, raised ${dayWords(item.raisedAt)}`} onClick={() => open(issuePaths.issue.path({ id: item.key }))} end="›" />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
