import { useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { itemsOf } from "../../../../features/backlogs";
import { useWord } from "../../../../features/agency/useWord";
import { callTool } from "../../../../shared/wakala/mcp";
import { IssueListScreen } from "./IssueListScreen";
import { nearbyIssues, nearbyTool } from "./nearbyIssues";
import { issuePaths } from "./paths";

type Item = Record<string, unknown>;

export const assignedToMeTitle = "Assigned to Me";

const mineTool = "forms_catalog_raised_item_list_mine";

const text = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const placeOf = (item: Item) => [text(item, "street"), text(item, "area")].filter(Boolean).join(", ");

const rowOf = (issue: Item) => ({ id: text(issue, "id"), title: text(issue, "title"), status: text(issue, "status") });

const mapRows = async () =>
  (await nearbyIssues()).map((issue) => ({ id: text(issue, "id"), title: text(issue, "title"), place: placeOf(issue) }));

function useOpenIssue(from: string) {
  const navigate = useNavigate();
  const here = useLocation();
  const seen = useRef(new Map<string, Item>());
  const remember = (rows: Item[]) => {
    seen.current = new Map(rows.map((row) => [text(row, "id"), row]));
    return rows;
  };
  const open = (id: string) =>
    navigate(issuePaths.issue.path({ id }), {
      state: { from: { path: `${here.pathname}${here.search}`, title: from }, issue: rowOf(seen.current.get(id) ?? { id }) },
    });
  return { remember, open };
}

export function AllIssuesScreen() {
  const word = useWord("forms");
  const title = `All ${word("Issues")}`;
  const { remember, open } = useOpenIssue(title);
  const load = async () => remember(await nearbyIssues());
  return <IssueListScreen title={title} tool={nearbyTool} fields={{ title: "title", meta: "status" }} empty={`No ${word("Issues").toLowerCase()} yet.`} load={load} onChoose={open} />;
}

export function AssignedToMeScreen() {
  const { remember, open } = useOpenIssue(assignedToMeTitle);
  const load = async () => remember(itemsOf(await callTool("", mineTool)) as Item[]);
  return <IssueListScreen title={assignedToMeTitle} tool={mineTool} fields={{ title: "title", meta: "status" }} empty="Nothing is assigned to you." load={load} onChoose={open} />;
}

export function MapViewScreen() {
  const word = useWord("forms");
  return <IssueListScreen title="Map View" tool={nearbyTool} fields={{ title: "title", meta: "place" }} empty={`No ${word("Issues").toLowerCase()} on the map yet.`} load={mapRows} />;
}

export function ServiceTypesScreen() {
  const word = useWord("forms");
  return <IssueListScreen title={word("Service Types")} tool="forms_catalog_entry_list" fields={{ title: "name", meta: "summary" }} empty={`No ${word("Service Types").toLowerCase()} yet.`} />;
}
