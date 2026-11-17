import { useState } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { useMay } from "../../../../features/agency/useMay";
import { Button } from "../../../../shared/ui/Button";
import { ChoiceGroup } from "../../../../shared/ui/ChoiceRow";
import { Field } from "../../../../shared/ui/Field";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed } from "../../../../shared/ui/LoadState";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";
import { refusalWords } from "../../MenuEditForm";
import { boardPermission } from "./IssueEdit";
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

function WishRow({ issueId, wish, onUngrouped }: { issueId: string; wish: Wish; onUngrouped: () => void }) {
  const { running, refused, attempt } = useAttempt();
  const ungroup = () =>
    attempt(async () => {
      await callTool("", "forms_catalog_raised_item_ungroup", { raisedItemID: issueId });
      onUngrouped();
    });
  return (
    <>
      <Rows>
        <ListRow title="Wish" meta={[wish.title, `raised by ${wish.raisedBy}`]} />
      </Rows>
      {refused ? <LoadFailed words={refused} /> : null}
      <Button kind="quiet" disabled={running} onClick={ungroup}>Ungroup</Button>
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
  if (wishes.state !== "ready") return null;
  const change = (next: string) => {
    setWishId(next);
    setReads(reads + 1);
  };
  if (!wishId) return <WishAdd issueId={issue.id} wishes={wishes.data} onGrouped={change} />;
  const wish = wishes.data.find((candidate) => candidate.id === wishId);
  return wish ? <WishRow issueId={issue.id} wish={wish} onUngrouped={() => change("")} /> : null;
}

export function IssueWish({ issue }: { issue: IssueRow }) {
  const may = useMay(boardPermission);
  return may ? <WishSection issue={issue} /> : null;
}
