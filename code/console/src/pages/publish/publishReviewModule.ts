import type { PageModule } from "../../data/types";

export const publishReviewPage: PageModule = {
  spec: {
    id: "publish-review",
    title: "Review",
    primary: "Run review",
    tools: ["agency_get_review", "agency_run_review", "agency_set_finding_status", "agency_comment_finding"],
    columns: [{ key: "name", label: "Finding" }],
  },
  rows: async () => [],
};
