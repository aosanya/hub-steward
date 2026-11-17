import { useRef, type ReactNode } from "react";
import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { callTool } from "../../../../shared/wakala/mcp";
import { agencyHomePath, openAgencyId } from "../../../../shared/wakala/openAgency";
import { MenuWindow } from "../../MenuWindow";
import { CatalogueWindow } from "../services/CatalogueEntry";
import { replyLabel } from "./IssueScreen";
import { IssueThread } from "./IssueThread";
import { nearbyIssues, nearbyTool } from "./nearbyIssues";
import { useReplyDrafts } from "./useReplyDrafts";

type Item = Record<string, unknown>;

export const assignedToMeTitle = "Assigned to Me";

const mineTool = "forms_catalog_raised_item_list_mine";

const text = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const placeOf = (item: Item) => [text(item, "street"), text(item, "area")].filter(Boolean).join(", ");

const rowOf = (issue: Item) => ({
  id: text(issue, "id"),
  title: text(issue, "title"),
  status: text(issue, "status"),
  department: text(issue, "department"),
  boardItemId: text(issue, "board_item_id"),
});

const mapRows = async () => (await nearbyIssues()).map((issue) => ({ ...issue, place: placeOf(issue) }));

const statusFields = { title: "title", meta: "status" };

type WindowProps = {
  title: string;
  tool: string;
  empty: string;
  fetch: () => Promise<Item[]>;
  fields?: { title: string; meta: string };
  end?: (item: Item) => ReactNode;
  loadingWords?: string;
  failedWords?: string;
};

export function IssueWindow({ title, tool, empty, fetch, fields = statusFields, end, loadingWords, failedWords }: WindowProps) {
  const seen = useRef(new Map<string, Item>());
  const replies = useReplyDrafts();
  const loadList = async () => {
    const issues = await fetch();
    seen.current = new Map(issues.map((issue) => [text(issue, "id"), issue]));
    return issues;
  };
  const loadIssue = async (id: string) => seen.current.get(id) ?? (await loadList()).find((issue) => text(issue, "id") === id) ?? { id };
  const list = { title, tool, fields, empty: { words: empty, act: "Home", to: agencyHomePath(openAgencyId()) }, load: loadList, end, loadingWords, failedWords };
  const detail = {
    tool,
    fields: { Issue: "title" },
    status: "status",
    load: loadIssue,
    action: { label: replyLabel, tool: "forms_catalog_reply_send", run: (item: Item) => replies.send(text(item, "id")) },
    extra: (item: Item) => {
      const issue = rowOf(item);
      return <IssueThread issue={issue} version={replies.version} draft={replies.draftOf(issue.id)} onDraft={(body) => replies.setDraft(issue.id, body)} failed={replies.failed} />;
    },
  };
  return <MenuWindow title={title} list={list} detail={detail} />;
}

export function AllIssuesScreen() {
  const word = useWord("forms");
  return <IssueWindow title={`All ${word("Issues")}`} tool={nearbyTool} empty={`No ${word("Issues").toLowerCase()} yet.`} fetch={nearbyIssues} />;
}

export function AssignedToMeScreen() {
  const mine = async () => itemsOf(await callTool("", mineTool)) as Item[];
  return <IssueWindow title={assignedToMeTitle} tool={mineTool} empty="Nothing is assigned to you." fetch={mine} />;
}

export function MapViewScreen() {
  const word = useWord("forms");
  return <IssueWindow title="Map View" tool={nearbyTool} fields={{ title: "title", meta: "place" }} empty={`No ${word("Issues").toLowerCase()} on the map yet.`} fetch={mapRows} />;
}

export function ServiceTypesScreen() {
  const word = useWord("forms");
  return <CatalogueWindow title={word("Service Types")} listTool="forms_catalog_entry_list" empty={`No ${word("Service Types").toLowerCase()} yet.`} />;
}
