import { useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { Button } from "../../../../shared/ui/Button";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { Sheet } from "../../../../shared/ui/Sheet";
import { TextArea } from "../../../../shared/ui/TextArea";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { actionFailedWords } from "../../MenuDetail";
import { MenuEditForm } from "../../MenuEditForm";
import { SectionAct } from "../residents/SectionAct";
import { boardPermission, departmentFields, IssueOutcome } from "./IssueEdit";
import { IssueWish } from "./IssueWish";
import type { IssueRow } from "./issueRow";
import type { ReplyDrafts } from "./useReplyDrafts";

type Item = Record<string, unknown>;

type Props = { item: Item; issue: IssueRow; replies: ReplyDrafts };

const textOf = (item: Item, key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");

const placeOf = (item: Item) => [textOf(item, "street"), textOf(item, "area")].filter(Boolean).join(", ");

function DepartmentSheet({ issue, department, onSaved, onClose }: { issue: IssueRow; department: string; onSaved: (department: string) => void; onClose: () => void }) {
  return (
    <Sheet title="Edit department" onClose={onClose}>
      <MenuEditForm
        bare
        openCount={1}
        item={{ department }}
        id={issue.id}
        idArg="raisedItemID"
        tool="forms_catalog_raised_item_reassign"
        permission={boardPermission}
        fields={departmentFields}
        onSaved={(changed) => {
          onSaved(changed.department ?? department);
          onClose();
        }}
        onCancel={onClose}
      />
    </Sheet>
  );
}

function ReplySheet({ id, replies, onClose }: { id: string; replies: ReplyDrafts; onClose: () => void }) {
  const draft = replies.draftOf(id);
  const send = () => {
    replies.send(id);
    onClose();
  };
  return (
    <Sheet title="Reply" onClose={onClose}>
      <TextArea label="Your reply" value={draft} onChange={(event) => replies.setDraft(id, event.target.value)} />
      <Button kind="primary" disabled={!draft.trim()} onClick={send}>Send reply</Button>
      <Button kind="quiet" onClick={onClose}>Cancel</Button>
    </Sheet>
  );
}

function ReplyCard({ id, replies }: { id: string; replies: ReplyDrafts }) {
  const [writing, setWriting] = useState(false);
  const view = useLoad(
    async () => itemsOf(await callTool("", "forms_catalog_reply_list", { raisedItemID: id })) as Item[],
    `issue-replies:${openAgencyId()}:${id}:${replies.version}`,
  );
  const found = view.state === "ready" ? view.data : [];
  const act = <button type="button" className="sec-act" onClick={() => setWriting(true)}>Reply</button>;
  return (
    <>
      <Section
        word="Replies"
        all
        icon="chat"
        foot={act}
        empty={{ words: view.state === "error" ? "The replies could not be loaded." : "No replies yet." }}
        rows={found.map((reply, at) => (
          <ListRow key={textOf(reply, "id") || at} title={textOf(reply, "body")} meta={textOf(reply, "created_at").slice(0, 10)} />
        ))}
      />
      {replies.failed ? <LoadFailed words={actionFailedWords} /> : null}
      {writing ? <ReplySheet id={id} replies={replies} onClose={() => setWriting(false)} /> : null}
    </>
  );
}

export function IssuePage({ item, issue, replies }: Props) {
  const [department, setDepartment] = useState(issue.department);
  const place = placeOf(item);
  const quiet = [issue.status, place].filter(Boolean).join(" · ");
  const rows = [
    ...(issue.status ? [<ListRow key="status" title="Status" meta={issue.status} />] : []),
    ...(department ? [<ListRow key="department" title="Department" meta={department} />] : []),
    ...(place ? [<ListRow key="place" title="Place" meta={place} />] : []),
  ];
  const act = (
    <SectionAct
      permission={boardPermission}
      act="Edit department"
      sheet={(close) => <DepartmentSheet issue={issue} department={department} onSaved={setDepartment} onClose={close} />}
    />
  );
  return (
    <>
      <div className="title-block">
        <h1 className="person-name">{issue.title}</h1>
        {quiet ? <p className="quiet-line">{quiet}</p> : null}
      </div>
      <div className="sections">
        <Section word="Issue" plain foot={act} empty={{ words: "Nothing is recorded on this issue yet." }} rows={rows} />
        <IssueWish issue={issue} />
        {issue.boardItemId ? <IssueOutcome boardItemId={issue.boardItemId} /> : null}
        <ReplyCard id={issue.id} replies={replies} />
      </div>
    </>
  );
}
