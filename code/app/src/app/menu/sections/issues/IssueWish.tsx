import { useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { ChoiceGroup } from "../../../../shared/ui/ChoiceRow";
import { Field } from "../../../../shared/ui/Field";
import { ListRow } from "../../../../shared/ui/ListRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { Section } from "../../../../shared/ui/Section";
import { Sheet } from "../../../../shared/ui/Sheet";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuEditForm, refusalWords } from "../../MenuEditForm";
import { SectionAct } from "../residents/SectionAct";
import { boardPermission, currentOutcome, outcomeFields } from "./IssueEdit";
import type { IssueRow } from "./issueRow";

type Wish = { id: string; title: string; raisedBy: number };

type Item = Record<string, unknown>;

const textOf = (value: unknown) => (typeof value === "string" ? value : "");

const countOf = (value: unknown) => (typeof value === "number" ? value : 0);

const loadWishes = async (): Promise<Wish[]> =>
  ((await callTool("", "forms_catalog_board_item_list", {}).then(itemsOf)) as Item[]).map((wish) => ({
    id: textOf(wish.id),
    title: textOf(wish.title),
    raisedBy: countOf(wish.raised_by),
  }));

const groupUnder = (issueId: string, wishId: string) =>
  callTool("", "forms_catalog_raised_item_group", { raisedItemID: issueId, board_item_id: wishId });

const startWish = async (title: string) => textOf(((await callTool("", "forms_catalog_board_item_put", { title })) as Item | null)?.id);

const useAttempt = () => {
  const [running, setRunning] = useState(false);
  const [refused, setRefused] = useState("");
  const attempt = async (act: () => Promise<void>) => {
    setRunning(true);
    setRefused("");
    try {
      await act();
    } catch (error) {
      setRefused(refusalWords(error));
    } finally {
      setRunning(false);
    }
  };
  return { running, refused, attempt };
};

function OutcomeSheet({ boardItemId, outcome, onSaved, onClose }: { boardItemId: string; outcome: string; onSaved: (outcome: string) => void; onClose: () => void }) {
  return (
    <Sheet title="Edit outcome" onClose={onClose}>
      <MenuEditForm
        bare
        openCount={1}
        item={{ outcome }}
        id={boardItemId}
        idArg="boardItemID"
        tool="forms_catalog_board_item_set_outcome"
        permission={boardPermission}
        fields={outcomeFields}
        onSaved={(changed) => {
          onSaved(changed.outcome ?? outcome);
          onClose();
        }}
        onCancel={onClose}
      />
    </Sheet>
  );
}

function WishCard({ issueId, wishId, wish, onUngrouped }: { issueId: string; wishId: string; wish?: Wish; onUngrouped: () => void }) {
  const { running, refused, attempt } = useAttempt();
  const read = useLoad(() => currentOutcome(wishId), `issue-outcome:${openAgencyId()}:${wishId}`);
  const [saved, setSaved] = useState<string | null>(null);
  const outcome = saved ?? (read.state === "ready" ? read.data : "");
  const ungroup = () =>
    attempt(async () => {
      await callTool("", "forms_catalog_raised_item_ungroup", { raisedItemID: issueId });
      onUngrouped();
    });
  const rows = [
    ...(wish ? [<ListRow key="wish" title={wish.title} meta={`raised by ${wish.raisedBy}`} />] : []),
    ...(outcome ? [<ListRow key="outcome" title="Outcome" meta={outcome} />] : []),
  ];
  const foot = (
    <>
      {wish ? <button type="button" className="sec-foot-item" disabled={running} onClick={ungroup}>Ungroup</button> : null}
      <SectionAct permission={boardPermission} act="Edit outcome" sheet={(close) => <OutcomeSheet boardItemId={wishId} outcome={outcome} onSaved={setSaved} onClose={close} />} />
    </>
  );
  return (
    <>
      <Section word={wish ? "Wish" : "Wish outcome"} plain rows={rows} foot={foot} empty={{ words: "No outcome yet." }} />
      {refused ? <LoadFailed words={refused} /> : null}
    </>
  );
}

function WishChoice({ issueId, wishes, onGrouped, onCancel }: { issueId: string; wishes: Wish[]; onGrouped: (wishId: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const { running, refused, attempt } = useAttempt();
  const groupWith = (findId: () => Promise<string>) =>
    attempt(async () => {
      const wishId = await findId();
      await groupUnder(issueId, wishId);
      onGrouped(wishId);
    });
  const newTitle = title.trim();
  return (
    <ChoiceGroup label="Add to wish" error={refused}>
      {wishes.map((wish) => (
        <Button key={wish.id} kind="quiet" disabled={running} onClick={() => groupWith(async () => wish.id)}>
          {wish.title}
        </Button>
      ))}
      <Field label="New wish" value={title} onChange={(event) => setTitle(event.target.value)} />
      <Button kind="primary" disabled={running || !newTitle} onClick={() => groupWith(() => startWish(newTitle))}>Start a new wish</Button>
      <Button kind="quiet" disabled={running} onClick={onCancel}>Cancel</Button>
    </ChoiceGroup>
  );
}

function WishAdd({ issueId, wishes, onGrouped }: { issueId: string; wishes: Wish[]; onGrouped: (wishId: string) => void }) {
  const [choosing, setChoosing] = useState(false);
  if (!choosing) return <Button kind="quiet" onClick={() => setChoosing(true)}>Add to wish</Button>;
  return <WishChoice issueId={issueId} wishes={wishes} onGrouped={onGrouped} onCancel={() => setChoosing(false)} />;
}

function WishSection({ issue }: { issue: IssueRow }) {
  const [wishId, setWishId] = useState(issue.boardItemId);
  const [reads, setReads] = useState(0);
  const wishes = useLoad(loadWishes, `issue-wishes:${openAgencyId()}:${reads}`);
  if (wishes.state === "loading") return null;
  const change = (next: string) => {
    setWishId(next);
    setReads(reads + 1);
  };
  if (wishes.state === "error") return wishId ? <WishCard issueId={issue.id} wishId={wishId} onUngrouped={() => change("")} /> : null;
  if (!wishId) return <WishAdd issueId={issue.id} wishes={wishes.data} onGrouped={change} />;
  const wish = wishes.data.find((candidate) => candidate.id === wishId);
  return <WishCard issueId={issue.id} wishId={wishId} wish={wish} onUngrouped={() => change("")} />;
}

export function IssueWish({ issue }: { issue: IssueRow }) {
  const may = useMay(boardPermission);
  return may ? <WishSection issue={issue} /> : null;
}
