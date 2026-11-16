import { test, expect } from "@playwright/test";
import { agencyNamed, cleanup, post, seedJourney, shootLive, signIn, type Journey } from "./helpers/live";

const journey = "00-smoke";
const agencyName = "Zöldhalom Town Council";

test.use({ viewport: { width: 390, height: 844 } });

test.describe(journey, () => {
  let seeded: Journey;
  let recordTitle: string;

  const listed = async (tool: string) => JSON.stringify(await post(seeded.who, tool, {}));

  test.beforeAll(async () => {
    agencyNamed(agencyName);
    seeded = await seedJourney(journey);
    recordTitle = seeded.named("smoke record");
  });

  test.afterAll(async () => {
    await cleanup(seeded);
  });

  test("a signed-in person posts one prefixed record, sees Home in the real app, and cleanup removes the record", async ({ page }) => {
    const raised = await seeded.post(
      "forms_catalog_raised_item_raise",
      { title: recordTitle, address: seeded.named("street") },
      (reply: { id: string }) => ({
        tool: "forms_catalog_raised_item_remove",
        args: { raisedItemID: reply.id, ground: `${journey} cleanup` },
      }),
    );
    expect(raised.id).toBeTruthy();
    expect(await listed("forms_catalog_raised_item_list_mine")).toContain(raised.id);

    await signIn(page, seeded.who);
    const path = await shootLive(page, journey, "home");
    expect(path).toContain("03-screenshots/menu-live/00-smoke/");

    await cleanup(seeded);
    expect(await listed("forms_catalog_removal_list_mine")).toContain(raised.id);
  });
});
