import { test, expect } from "@playwright/test";
import { figureAt, openMockup, shoot } from "./helpers/shoot";

const journey = "00-home";
const sections = [
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
const sectionPages = [
  "menu-residents.html",
  "menu-properties.html",
  "menu-issues.html",
  "menu-services.html",
  "menu-assets.html",
  "menu-council.html",
  "menu-staff.html",
  "menu-settings.html",
  "menu-finance.html",
];

test.describe("a municipal staff member opens the phone app", () => {
  test.beforeEach(async ({ page }) => {
    await openMockup(page, "menu.html");
  });

  test("Home shows Start, Ongoing and Backlogs, then a row for each section", async ({ page }) => {
    const home = figureAt(page, "s1");
    const titles = await home.locator(".row .ttl").allTextContents();
    expect(titles).toEqual(["Start", "Ongoing", "Backlogs", ...sections]);
    await expect(home.locator("nav.tabs")).toHaveAttribute("data-chosen", "home");
    await shoot(home, journey, "home-with-the-sections");
  });

  test("a section row opens the section's submenus under a Back that reads Home", async ({ page }) => {
    const section = figureAt(page, "s2");
    await expect(section.locator(".back")).toHaveText("Home");
    await expect(section.locator(".bar-title")).toHaveText("Issues & Requests");
    await expect(section.locator(".row .ttl")).toHaveText([
      "All Issues",
      "Assigned to Me",
      "Overdue",
      "Map View",
      "Service Types",
    ]);
    await shoot(section, journey, "section-with-one-screen");
  });

  test("a submenu with a screen is a button and the Forms section opens its list", async ({ page }) => {
    const section = figureAt(page, "s3");
    await expect(section.locator(".back")).toHaveText("Home");
    await expect(section.locator(".bar-title")).toHaveText("Services & Permits");
    await expect(section.locator("a.row .ttl")).toHaveText(["Applications"]);
    await shoot(section, journey, "section-that-opens-the-forms");
  });

  test("a submenu with no screen says Not available yet and is not a button", async ({ page }) => {
    const section = figureAt(page, "s4");
    await expect(section.locator(".back")).toHaveText("Home");
    await expect(section.locator(".bar-title")).toHaveText("Residents");
    await expect(section.locator(".row")).toHaveCount(5);
    await expect(section.locator(".row .chip")).toHaveText(Array(5).fill("Not available yet"));
    await expect(section.locator("a.row")).toHaveCount(0);
    await shoot(section, journey, "nothing-built-yet");
  });

  test("a smaller agency's Home draws only the sections it has and Settings beside them", async ({ page }) => {
    const home = figureAt(page, "s5");
    const titles = await home.locator(".row .ttl").allTextContents();
    expect(titles).toEqual([
      "Start",
      "Ongoing",
      "Backlogs",
      "Residents",
      "Issues & Requests",
      "Services & Permits",
      "Staff & Departments",
      "Settings",
    ]);
    await shoot(home, journey, "home-of-a-smaller-agency");
  });

  test("every section's drawing page is linked from the page and opens", async ({ page }) => {
    for (const file of sectionPages) {
      expect(await page.locator(`a[href="${file}"]`).count()).toBeGreaterThan(0);
    }
    for (const file of sectionPages) {
      await openMockup(page, file);
      await expect(page.locator("figure .phone").first()).toBeVisible();
    }
  });
});
