import { test } from "@playwright/test";
import { settings } from "./helpers/env";
import { groupOrder } from "./helpers/plans";
import { walkTheTest } from "./helpers/walk";

test("Group order runs from the Test page, played by the agency's own AI account", async ({ page }) => {
  const s = settings();
  await walkTheTest(page, s, {
    title: "Backend monitor: Group order on the Test page",
    plan: groupOrder,
    draftDescription: "Group order test",
    monitorFile: "backend-monitor-group-order.md",
    shots: {
      signedIn: "group-order-01-signed-in.png",
      testPage: "group-order-02-test-page.png",
      waiting: "group-order-03-run-waiting.png",
      finished: "group-order-04-run-finished.png",
      failedStep: "group-order-05-failed-step.png",
    },
  });
});
