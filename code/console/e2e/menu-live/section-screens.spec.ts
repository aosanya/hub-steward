import { test, expect, type Page } from "@playwright/test";
import { post, shootLive, signIn } from "./helpers/live";

const journey = "02-section-screens";
const who = "own14";
const notYetWords = "Not available yet";

type Section = { slug: string; title: string; module: string; items: string[]; opens: Record<string, RegExp> };

const sections: Section[] = [
  { slug: "residents", title: "Residents", module: "actor", items: ["All Residents", "Households", "Registrations", "Groups & Associations", "Communications"], opens: {} },
  { slug: "properties", title: "Properties & Addresses", module: "digitaltwin", items: ["Properties", "Addresses", "Ownership & Tenure", "Land Use & Zoning"], opens: {} },
  { slug: "issues", title: "Issues & Requests", module: "forms", items: ["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types"], opens: { Overdue: /\/council\/late-matters/ } },
  { slug: "services", title: "Services & Permits", module: "forms", items: ["Applications", "Permits", "Licences", "Fees & Payments", "Service Catalogue"], opens: { Applications: /\/forms$/ } },
  { slug: "assets", title: "Assets & Works", module: "assetmanager", items: ["Roads & Paths", "Street Lights", "Water Points", "Buildings", "Work Orders", "Maintenance Schedule"], opens: {} },
  { slug: "council", title: "Council & Decisions", module: "voting", items: ["Meetings", "Agendas & Minutes", "Resolutions", "Bylaws", "Committees"], opens: {} },
  { slug: "staff", title: "Staff & Departments", module: "actor", items: ["Staff", "Departments", "Crews", "Roles & Permissions"], opens: {} },
  { slug: "finance", title: "Finance", module: "accounting", items: ["Budget", "Revenue & Billing", "Procurement", "Payments", "Financial Reports"], opens: {} },
  { slug: "settings", title: "Settings", module: "", items: ["Municipality Profile", "Users & Roles", "Boundaries & Wards", "Integrations", "Audit Log"], opens: {} },
];

let mountedModules: string[] = [];
let shownSections: Section[] = [];

const rowTitles = (page: Page) => page.locator(".ttl").allTextContents();

const settledTitles = async (page: Page) => {
  await expect(page.locator(".ttl", { hasText: /^Settings$/ })).toBeVisible();
  return rowTitles(page);
};

const openSection = async (page: Page, slug: string) => {
  await signIn(page, who);
  const titles = await settledTitles(page);
  const position = shownSections.findIndex((section) => section.slug === slug);
  if (position < 0) throw new Error(`section ${slug} is not shown on this hub`);
  const shown = titles[titles.indexOf("Settings") - (shownSections.length - 1) + position];
  await page.locator(".ttl", { hasText: new RegExp(`^${shown.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).click();
  await expect(page).toHaveURL(new RegExp(`/menu/${slug}$`));
};

test.describe(journey, () => {
  test.beforeAll(async () => {
    const reply = await post(who, "agency_list_mounts", {});
    mountedModules = (reply.modules ?? []).map((entry: { module: string }) => entry.module);
    const held = sections.filter((section) => section.module === "" || mountedModules.includes(section.module));
    shownSections = held.length > 1 ? held : [];
  });

  test("Home lists exactly the sections whose modules the hub has mounted, in order", async ({ page }) => {
    await signIn(page, who);
    const titles = await settledTitles(page);
    const after = titles.slice(titles.indexOf("Backlogs") + 1);
    expect(after.slice(0, shownSections.length)).toHaveLength(shownSections.length);
    expect(shownSections.length).toBeGreaterThan(0);
    await shootLive(page, journey, "home");
  });

  test("MUN962 Home titles every section with its own words, never a module code", async ({ page }) => {
    await signIn(page, who);
    const titles = await settledTitles(page);
    shownSections.forEach((section) => expect(titles).toContain(section.title));
    expect(titles).not.toContain("actor");
  });

  for (const section of sections) {
    test(`a staff member opens ${section.title} from Home and reads its submenus`, async ({ page }) => {
      test.skip(!shownSections.includes(section), `${section.module} is not mounted on this hub`);
      await openSection(page, section.slug);
      for (const item of section.items) await expect(page.getByText(item, { exact: true })).toBeVisible();
      const unbuilt = section.items.filter((item) => !(item in section.opens));
      await expect(page.getByText(notYetWords, { exact: true })).toHaveCount(unbuilt.length);
      await shootLive(page, journey, section.slug);
    });
  }

  test("a submenu without a screen says Not available yet and stays on the section", async ({ page }) => {
    await openSection(page, "residents");
    await page.getByText("All Residents", { exact: true }).click();
    await expect(page).toHaveURL(/\/menu\/residents$/);
    await expect(page.getByText(notYetWords, { exact: true }).first()).toBeVisible();
  });

  for (const [slug, item, route] of [
    ["issues", "Overdue", /\/council\/late-matters/],
    ["services", "Applications", /\/forms$/],
  ] as const) {
    test(`${item} opens its real screen and Back returns to its section`, async ({ page }) => {
      await openSection(page, slug);
      await page.getByText(item, { exact: true }).click();
      await expect(page).toHaveURL(route);
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/menu/${slug}$`));
    });
  }

  test("Back from a section returns to Home", async ({ page }) => {
    test.skip(shownSections.length === 0, "no section is shown on this hub");
    await openSection(page, shownSections[0].slug);
    await page.getByRole("button", { name: /^\W*Home$/ }).first().click();
    await expect(page).toHaveURL(/\/home$/);
  });
});
