import { itemsOf } from "../../../../features/backlogs";
import { useLoad } from "../../../../features/forms/useLoad";
import { ListRow, Rows } from "../../../../shared/ui/ListRow";
import { LoadFailed, LoadingLine } from "../../../../shared/ui/LoadState";
import { SectionHeading } from "../../../../shared/ui/SectionHeading";
import { callTool } from "../../../../shared/wakala/mcp";
import { openAgencyId } from "../../../../shared/wakala/openAgency";

type Item = Record<string, unknown>;

type Props = { raisedItemID: string; version: number };

const textOf = (item: Item, key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");

export const repliesFailedWords = "The replies could not be loaded.";

export function IssueReplies({ raisedItemID, version }: Props) {
  const view = useLoad(
    async () => itemsOf(await callTool("", "forms_catalog_reply_list", { raisedItemID })) as Item[],
    `issue-replies:${openAgencyId()}:${raisedItemID}:${version}`,
  );
  const replies = view.state === "ready" ? view.data : [];
  return (
    <>
      <SectionHeading>Replies</SectionHeading>
      {view.state === "loading" ? <LoadingLine /> : null}
      {view.state === "error" ? <LoadFailed words={repliesFailedWords} /> : null}
      {replies.length > 0 ? (
        <Rows>
          {replies.map((reply, at) => (
            <ListRow key={textOf(reply, "id") || at} title={textOf(reply, "body")} meta={textOf(reply, "created_at").slice(0, 10)} />
          ))}
        </Rows>
      ) : null}
    </>
  );
}
