import { test, expect, type Page } from "@playwright/test";
import { shootLive, signIn } from "./helpers/live";
import { modulesOffered, mountedModules, mountOnly, mountsAgencyName, prepareThrowawayAgency, switchOffActor } from "./helpers/throwawayAgency";

const journey = "05-mounts";
const who = "own14";
const notYetWords = "Not available yet";

const sectionsOfModule: Record<string, string[]> = {
  actor: ["Residents", "Staff & Departments"],
  digitaltwin: ["Properties & Addresses"],
  assetmanager: ["Assets & Works"],
  forms: ["Issues & Requests", "Services & Permits"],
};

const orderOnHome = ["Residents", "Properties & Addresses", "Issues & Requests", "Services & Permits", "Assets & Works", "Staff & Departments", "Settings"];

const submenus: Record<string, string[]> = {
  properties: ["Properties", "Addresses", "Ownership & Tenure", "Land Use & Zoning"],
  assets: ["Roads & Paths", "Street Lights", "Water Points", "Buildings", "Work Orders", "Maintenance Schedule"],
};

let offered: string[] = [];

const expectedRows = (modules: string[]) => {
  const named = new Set(["actor", ...modules].flatMap((code) => sectionsOfModule[code] ?? []));
  named.add("Settings");
  return orderOnHome.filter((title) => named.has(title));
};

const homeRows = async (page: Page) => {
  await signIn(page, who);
  await expect(page.locator(".row .ttl", { hasText: "Residents" })).toBeVisible();
  const titles = await page.locator(".row .ttl").allTextContents();
  return titles.filter((title) => orderOnHome.includes(title));
};

const openSection = async (page: Page, title: string, slug: string) => {
  await signIn(page, who);
  await page.locator(".ttl", { hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).click();
  await expect(page).toHaveURL(new RegExp(`/menu/${slug}$`));
};

const mountAndSee = async (page: Page, wanted: string[], step: string) => {
  const mountable = wanted.filter((code) => offered.includes(code));
  await mountOnly(mountable);
  const rows = await homeRows(page);
  expect(rows).toEqual(expectedRows(mountable));
  await shootLive(page, journey, step);
  return rows;
};

test.use({ viewport: { width: 390, height: 844 } });

test.describe(journey, () => {
  test.beforeAll(async () => {
    await prepareThrowawayAgency(mountsAgencyName, who);
    offered = await modulesOffered(who);
  });

  test("with only the actor module mounted Home shows its two sections and Settings", async ({ page }) => {
    await mountOnly([]);
    const mounted = await mountedModules();
    for (const code of Object.keys(sectionsOfModule).filter((code) => code !== "actor")) expect(mounted).not.toContain(code);
    const rows = await homeRows(page);
    expect(rows).toEqual(expectedRows([]));
    expect(rows).toEqual(["Residents", "Staff & Departments", "Settings"]);
    await shootLive(page, journey, "actor-only");
  });

  test("mounting digitaltwin adds Properties & Addresses", async ({ page }) => {
    await mountAndSee(page, ["digitaltwin"], "digitaltwin-mounted");
  });

  test("Properties & Addresses opens and lists its submenus", async ({ page }) => {
    await mountOnly(["digitaltwin"]);
    await openSection(page, "Properties & Addresses", "properties");
    for (const item of submenus.properties) await expect(page.getByText(item, { exact: true })).toBeVisible();
    await expect(page.getByText(notYetWords, { exact: true })).toHaveCount(submenus.properties.length);
    await shootLive(page, journey, "properties-and-addresses");
  });

  test("mounting assetmanager adds Assets & Works", async ({ page }) => {
    test.skip(!offered.includes("assetmanager"), "assetmanager is not in this hub's module list; the QA hub needs a rebuild");
    await mountAndSee(page, ["assetmanager"], "assetmanager-mounted");
  });

  test("Assets & Works opens and lists its submenus", async ({ page }) => {
    test.skip(!offered.includes("assetmanager"), "assetmanager is not in this hub's module list; the QA hub needs a rebuild");
    await mountOnly(["assetmanager"]);
    await openSection(page, "Assets & Works", "assets");
    for (const item of submenus.assets) await expect(page.getByText(item, { exact: true })).toBeVisible();
    await expect(page.getByText(notYetWords, { exact: true })).toHaveCount(submenus.assets.length);
    await shootLive(page, journey, "assets-and-works");
  });

  test("mounting forms adds Issues & Requests and Services & Permits", async ({ page }) => {
    await mountAndSee(page, ["forms"], "forms-mounted");
  });

  test("unmounting every optional module takes their rows off Home", async ({ page }) => {
    await mountOnly(["digitaltwin", "assetmanager", "forms"]);
    await mountOnly([]);
    const rows = await homeRows(page);
    expect(rows).toEqual(["Residents", "Staff & Departments", "Settings"]);
    await shootLive(page, journey, "unmounted-rows-left");
  });

  test("the actor module cannot be switched off, so Home never draws nothing", async ({ page }) => {
    await mountOnly([]);
    expect(await switchOffActor()).toBe(true);
    const rows = await homeRows(page);
    expect(rows).toEqual(["Residents", "Staff & Departments", "Settings"]);
    await shootLive(page, journey, "actor-cannot-be-unmounted");
  });
});
