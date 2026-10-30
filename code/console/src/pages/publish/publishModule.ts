import type { PageModule } from "../../data/types";
import { notPassedRows } from "./publishData";

export const publishPage: PageModule = {
  spec: {
    id: "publish",
    title: "Publish",
    primary: "Publish",
    tools: [
      "agency_list_drafts",
      "agency_list_approvals",
      "agency_list_publications",
      "agency_list_scenarios",
      "agency_list_test_runs",
      "agency_list_issues",
      "agency_publish_agency",
    ],
    columns: [
      { key: "name", label: "Scenario" },
      { key: "result", label: "Result" },
    ],
  },
  rows: (hubId) => notPassedRows(hubId),
};
