import { test, expect, type Page } from "@playwright/test";
import { cleanup, post, seedJourney, shootLive, signIn } from "./helpers/live";

const journey = "01-home-rows";
const openAgencyKey = "hubsteward.openAgency";

const mountedModules = async (agencyId: string, modules: string[]) => {
  for (const module of modules) {
    await post("owner", "agency_set_module_enabled", { instance_id: agencyId, module, enabled: true });
  }
};

const homeRows = async (page: Page, agencyId: string) => {
  await page.addInitScript(([key, id]) => sessionStorage.setItem(key, id), [openAgencyKey, agencyId]);
  await page.goto("/");
  await page.getByRole("button", { name: "Home" }).first().click();
};

const rowTitles = (page: Page) => page.locator("[data-row-title], .ttl").allTextContents();

test.describe(journey, () => {
  let agencyId = "";

  test.beforeAll(async () => {
    const seed = await seedJourney(journey);
    agencyId = seed.agencyId;
  });

  test.afterAll(async () => {
    await cleanup(journey);
  });

  test("with only the actor module mounted Home lists Residents and Staff & Departments", async ({ page }) => {
    await signIn(page, "tester05");
    await mountedModules(agencyId, ["actor"]);
    await homeRows(page, agencyId);
    const titles = await rowTitles(page);
    expect(titles).toContain("Residents");
    expect(titles).toContain("Staff & Departments");
    expect(titles).toContain("Settings");
    expect(titles).not.toContain("Properties & Addresses");
    await shootLive(page, journey, "actor-mounted");
  });

  test("mounting digitaltwin adds Properties & Addresses", async ({ page }) => {
    await signIn(page, "tester05");
    await mountedModules(agencyId, ["digitaltwin"]);
    await homeRows(page, agencyId);
    expect(await rowTitles(page)).toContain("Properties & Addresses");
    await shootLive(page, journey, "digitaltwin-mounted");
  });

  test("mounting forms adds Issues & Requests and Services & Permits", async ({ page }) => {
    await signIn(page, "tester05");
    await mountedModules(agencyId, ["forms"]);
    await homeRows(page, agencyId);
    const titles = await rowTitles(page);
    expect(titles).toContain("Issues & Requests");
    expect(titles).toContain("Services & Permits");
    await shootLive(page, journey, "forms-mounted");
  });
});
