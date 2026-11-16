import { useLocation, useNavigate } from "react-router-dom";
import { itemsOf } from "../../../../features/backlogs";
import { callTool } from "../../../../shared/wakala/mcp";
import { IssueListScreen } from "./IssueListScreen";
import { issuePaths } from "./paths";

type Item = Record<string, unknown>;

export const allIssuesTitle = "All Issues";

const nearbyTool = "forms_catalog_raised_item_list_nearby";

const text = (item: Item, key: string) => {
  const value = item[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const placeOf = (item: Item) => [text(item, "street"), text(item, "area")].filter(Boolean).join(", ");

const mapRows = async () =>
  (itemsOf(await callTool("", nearbyTool)) as Item[]).map((issue) => ({ id: text(issue, "id"), title: text(issue, "title"), place: placeOf(issue) }));

export function AllIssuesScreen() {
  const navigate = useNavigate();
  const here = useLocation();
  const open = (id: string) =>
    navigate(issuePaths.issue.path({ id }), { state: { from: { path: `${here.pathname}${here.search}`, title: allIssuesTitle } } });
  return <IssueListScreen title={allIssuesTitle} tool={nearbyTool} fields={{ title: "title", meta: "status" }} empty="No issues yet." onChoose={open} />;
}

export function AssignedToMeScreen() {
  return <IssueListScreen title="Assigned to Me" tool="forms_catalog_raised_item_list_mine" fields={{ title: "title", meta: "status" }} empty="Nothing is assigned to you." />;
}

export function MapViewScreen() {
  return <IssueListScreen title="Map View" tool={nearbyTool} fields={{ title: "title", meta: "place" }} empty="No issues on the map yet." load={mapRows} />;
}

export function ServiceTypesScreen() {
  return <IssueListScreen title="Service Types" tool="forms_catalog_entry_list" fields={{ title: "name", meta: "summary" }} empty="No service types yet." />;
}
