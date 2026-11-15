import { test, expect, type Page } from "@playwright/test";
import { cleanup, post, seedJourney, shootLive, signIn } from "./helpers/live";

const journey = "02-section-screens";
const openAgencyKey = "hubsteward.openAgency";
const allModules = ["actor", "digitaltwin", "forms", "assetmanager", "voting", "accounting"];
const notYetWords = "Not available yet";

type Section = { slug: string; title: string; items: string[]; opens: Record<string, RegExp> };

const sections: Section[] = [
  { slug: "residents", title: "Residents", items: ["All Residents", "Households", "Registrations", "Groups & Associations", "Communications"], opens: {} },
  { slug: "properties", title: "Properties & Addresses", items: ["Properties", "Addresses", "Ownership & Tenure", "Land Use & Zoning"], opens: {} },
  { slug: "issues", title: "Issues & Requests", items: ["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types"], opens: { Overdue: /\/council\/late-matters/ } },
  { slug: "services", title: "Services & Permits", items: ["Applications", "Permits", "Licences", "Fees & Payments", "Service Catalogue"], opens: { Applications: /\/forms/ } },
  { slug: "assets", title: "Assets & Works", items: ["Roads & Paths", "Street Lights", "Water Points", "Buildings", "Work Orders", "Maintenance Schedule"], opens: {} },
  { slug: "council", title: "Council & Decisions", items: ["Meetings", "Agendas & Minutes", "Resolutions", "Bylaws", "Committees"], opens: {} },
  { slug: "staff", title: "Staff & Departments", items: ["Staff", "Departments", "Crews", "Roles & Permissions"], opens: {} },
  { slug: "finance", title: "Finance", items: ["Budget", "Revenue & Billing", "Procurement", "Payments", "Financial Reports"], opens: {} },
  { slug: "settings", title: "Settings", items: ["Municipality Profile", "Users & Roles", "Boundaries & Wards", "Integrations", "Audit Log"], opens: {} },
];

const openHome = async (page: Page, agencyId: string) => {
  await page.addInitScript(([key, id]) => sessionStorage.setItem(key, id), [openAgencyKey, agencyId]);
  await page.goto("/");
  await page.getByRole("button", { name: "Home" }).first().click();
};

const rowNamed = (page: Page, title: string) => page.getByRole("button", { name: title, exact: false }).first();

test.describe(journey, () => {
  let agencyId = "";

  test.beforeAll(async () => {
    const seed = await seedJourney(journey);
    agencyId = seed.agencyId;
    for (const module of allModules) {
      await post("owner", "agency_set_module_enabled", { instance_id: agencyId, module, enabled: true });
    }
  });

  test.afterAll(async () => {
    await cleanup(journey);
  });

  for (const section of sections) {
    test(`a staff member opens ${section.title} from Home and reads its submenus`, async ({ page }) => {
      await signIn(page, "tester05");
      await openHome(page, agencyId);
      await rowNamed(page, section.title).click();
      await expect(page).toHaveURL(new RegExp(`/menu/${section.slug}$`));
      for (const item of section.items) await expect(page.getByText(item, { exact: true })).toBeVisible();
      const unbuilt = section.items.filter((item) => !(item in section.opens));
      await expect(page.getByText(notYetWords, { exact: true })).toHaveCount(unbuilt.length);
      await shootLive(page, journey, section.slug);
    });
  }

  test("a submenu without a screen says Not available yet and stays on the section", async ({ page }) => {
    await signIn(page, "tester05");
    await openHome(page, agencyId);
    await rowNamed(page, "Residents").click();
    await page.getByText("All Residents", { exact: true }).click();
    await expect(page).toHaveURL(/\/menu\/residents$/);
    await expect(page.getByText(notYetWords, { exact: true }).first()).toBeVisible();
  });

  for (const section of sections.filter((entry) => Object.keys(entry.opens).length > 0)) {
    for (const [item, route] of Object.entries(section.opens)) {
      test(`${item} under ${section.title} opens its real screen and Back returns to the section`, async ({ page }) => {
        await signIn(page, "tester05");
        await openHome(page, agencyId);
        await rowNamed(page, section.title).click();
        await page.getByText(item, { exact: true }).click();
        await expect(page).toHaveURL(route);
        await page.goBack();
        await expect(page).toHaveURL(new RegExp(`/menu/${section.slug}$`));
      });
    }
  }

  test("Back from a section returns to Home", async ({ page }) => {
    await signIn(page, "tester05");
    await openHome(page, agencyId);
    await rowNamed(page, "Finance").click();
    await page.goBack();
    await expect(rowNamed(page, "Finance")).toBeVisible();
  });
});
