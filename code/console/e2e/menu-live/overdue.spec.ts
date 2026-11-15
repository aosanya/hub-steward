import { test, expect, type Page } from "@playwright/test";
import { backdateRaisedItem, cleanup, seedJourney, shootLive, signIn, type Journey } from "./helpers/live";

const journey = "03-overdue";
const staff = "own14";
const daysPastTheClock = 15;

const raiseIssue = (seed: Journey, name: string) =>
  seed.post(
    "forms_catalog_raised_item_raise",
    { title: seed.named(name), address: seed.named("street") },
    (raised: { id: string }) => ({
      tool: "forms_catalog_raised_item_remove",
      args: { raisedItemID: raised.id, ground: `${journey} cleanup` },
    }),
  );

const openOverdueByAddress = async (page: Page, agencyId: string) => {
  await page.goto(`/a/${agencyId}/council/late-matters`);
  await expect(page.getByText("Late matters").first()).toBeVisible();
};

const openOverdueFromHome = async (page: Page) => {
  await page.getByText("Issues & Requests", { exact: true }).click();
  await shootLive(page, journey, "issues-and-requests");
  await page.getByText("Overdue", { exact: true }).click();
  await expect(page).toHaveURL(/\/council\/late-matters$/);
};

test.describe(journey, () => {
  let seed: Journey;

  test.beforeAll(async () => {
    seed = await seedJourney(journey, staff);
  });

  test.afterAll(async () => {
    await cleanup(seed);
  });

  test("Overdue, opened by its address, does not list an issue raised just now", async ({ page }) => {
    const signedIn = await signIn(page, staff);
    await shootLive(page, journey, "home");
    await raiseIssue(seed, "fresh pothole report");
    await openOverdueByAddress(page, signedIn.agency);
    await expect(page.getByText(seed.named("fresh pothole report"))).toHaveCount(0);
    await shootLive(page, journey, "overdue-without-the-fresh-issue");
  });

  test.fixme("Overdue is reached from Home through the Issues & Requests row", async ({ page }) => {
    await signIn(page, staff);
    await openOverdueFromHome(page);
    await shootLive(page, journey, "overdue-from-home");
  });

  test.fixme("an issue past its answer clock is listed under Overdue with its days late", async ({ page }) => {
    const signedIn = await signIn(page, staff);
    const late = await raiseIssue(seed, "late pothole report");
    backdateRaisedItem(late.id, daysPastTheClock);
    await openOverdueByAddress(page, signedIn.agency);
    const row = page.getByText(seed.named("late pothole report"));
    await expect(row).toBeVisible();
    await expect(page.getByText(`${daysPastTheClock} days late`).first()).toBeVisible();
    await shootLive(page, journey, "overdue-with-the-late-issue");
  });
});
