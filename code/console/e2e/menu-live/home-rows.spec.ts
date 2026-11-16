import { test, expect, type Page } from "@playwright/test";
import { cleanup, seedJourney, shootLive, signIn } from "./helpers/live";
import { mountedModules, mountOnly, prepareThrowawayAgency } from "./helpers/throwawayAgency";

const journey = "01-home-rows";
const agencyName = "01-home-rows agency";
const owner = "own14";
const optionalModules = ["digitaltwin", "assetmanager", "forms", "accounting", "voting"];

const sectionsOfModule: Record<string, string[]> = {
  actor: ["Residents", "Staff & Departments"],
  digitaltwin: ["Properties & Addresses"],
  forms: ["Issues & Requests", "Services & Permits"],
  assetmanager: ["Assets & Works"],
  voting: ["Council & Decisions"],
  accounting: ["Finance"],
};

const orderOnHome = [
  "Residents",
  "Properties & Addresses",
  "Issues & Requests",
  "Services & Permits",
  "Assets & Works",
  "Council & Decisions",
  "Staff & Departments",
  "Finance",
  "Settings",
];

const expectedSections = (moduleCodes: string[]) => {
  const named = new Set(["actor", ...moduleCodes].flatMap((code) => sectionsOfModule[code] ?? []));
  named.add("Settings");
  return orderOnHome.filter((title) => named.has(title));
};

const sectionRowTitles = async (page: Page) => {
  await signIn(page, owner);
  await expect(page.locator(".row .ttl", { hasText: "Settings" })).toBeVisible();
  const titles = await page.locator(".row .ttl").allTextContents();
  return titles.filter((title) => orderOnHome.includes(title));
};

const mountExactly = async (wanted: string[]) => {
  const mounted = (await mountedModules(owner)).filter((code) => optionalModules.includes(code));
  const same = mounted.length === wanted.length && wanted.every((code) => mounted.includes(code));
  if (!same) await mountOnly(wanted, owner);
};

test.use({ viewport: { width: 390, height: 844 } });

test.describe(journey, () => {
  test.beforeAll(async () => {
    await prepareThrowawayAgency(agencyName, owner);
    await seedJourney(journey, owner);
  });

  test.afterAll(async () => {
    await cleanup(journey);
    await mountExactly([]);
  });

  test("with no optional module mounted Home draws only the actor rows and Settings", async ({ page }) => {
    await mountExactly([]);
    const titles = await sectionRowTitles(page);
    expect(titles).toEqual(["Residents", "Staff & Departments", "Settings"]);
    expect(titles).toEqual(expectedSections([]));
    for (const code of ["digitaltwin", "forms", "assetmanager", "voting", "accounting"]) {
      for (const title of sectionsOfModule[code]) expect(titles).not.toContain(title);
    }
    await shootLive(page, journey, "no-optional-module");
  });

  test("mounting the actor module shows the Residents row", async ({ page }) => {
    await mountExactly([]);
    expect(await mountedModules(owner)).toContain("actor");
    const titles = await sectionRowTitles(page);
    expect(titles).toContain("Residents");
    expect(titles[0]).toBe("Residents");
    expect(titles).toEqual(expectedSections(["actor"]));
    await shootLive(page, journey, "actor-mounted");
  });

  test("Settings is drawn last and only beside another section", async ({ page }) => {
    for (const modules of [[], ["forms"]]) {
      await mountExactly(modules);
      const titles = await sectionRowTitles(page);
      expect(titles).toContain("Settings");
      expect(titles[titles.length - 1]).toBe("Settings");
      expect(titles.length).toBeGreaterThan(1);
    }
    await page.locator(".row .ttl", { hasText: "Settings" }).scrollIntoViewIfNeeded();
    await shootLive(page, journey, "settings-beside-sections");
  });

  test("mounting forms adds Issues & Requests and Services & Permits", async ({ page }) => {
    await mountExactly(["forms"]);
    expect(await mountedModules(owner)).toContain("forms");
    const titles = await sectionRowTitles(page);
    expect(titles).toEqual(expectedSections(["forms"]));
    expect(titles).toEqual(["Residents", "Issues & Requests", "Services & Permits", "Staff & Departments", "Settings"]);
    await shootLive(page, journey, "forms-mounted");
  });

  test("mounting digitaltwin adds Properties & Addresses beside Residents", async ({ page }) => {
    await mountExactly(["digitaltwin"]);
    expect(await mountedModules(owner)).toContain("digitaltwin");
    const titles = await sectionRowTitles(page);
    expect(titles).toEqual(expectedSections(["digitaltwin"]));
    expect(titles).toEqual(["Residents", "Properties & Addresses", "Staff & Departments", "Settings"]);
    await shootLive(page, journey, "digitaltwin-mounted");
  });
});
