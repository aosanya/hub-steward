import { test } from "@playwright/test";
import { settings } from "./helpers/env";
import { sellHarvest } from "./helpers/plans";
import { walkTheTest } from "./helpers/walk";

test("Sell harvest runs from the Test page, played by the agency's own AI account", async ({ page }) => {
  const s = settings();
  await walkTheTest(page, s, {
    title: "Backend monitor: Sell harvest on the Test page",
    plan: sellHarvest,
    draftDescription: "Sell harvest test",
    monitorFile: "backend-monitor.md",
    shots: {
      signedIn: "step-01-signed-in.png",
      testPage: "step-02-test-page.png",
      waiting: "step-03-run-waiting.png",
      finished: "step-04-run-finished.png",
      failedStep: "step-05-failed-step.png",
    },
  });
});
