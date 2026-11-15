import { test, expect, type Page } from "@playwright/test";
import { openMockup, shoot } from "./helpers/shoot";

const journey = "03-issues";
const section = "Issues & Requests";

const screens = [
  { figure: "all-issues", title: "All Issues", step: "all-issues" },
  { figure: "mun915", title: "Issue", step: "an-issue" },
  { figure: "fig-mun918", title: "Assigned to Me", step: "assigned-to-me" },
  { figure: "fig-mun921", title: "Overdue", step: "overdue" },
  { figure: "fig-mun924", title: "Map View", step: "map-view" },
  { figure: "fig-mun927", title: "Service Types", step: "service-types" },
];

const readsOnFigure = async (page: Page, figureId: string) => {
  const figure = page.locator(`figure#${figureId}`);
  const phone = figure.locator(".phone");
  await expect(figure.locator(".cap-row dt", { hasText: "Landing" })).toHaveCount(1);
  await expect(figure.locator(".cap-row dt", { hasText: "Filled by" })).toHaveCount(1);
  await expect(figure.locator(".cap-row dt", { hasText: "Example data" })).toHaveCount(1);
  await expect(figure.locator(".cap-row", { hasText: "Filled by" })).toContainText(/no tool|supplies/i);
  await expect(figure.locator(".cap-row", { hasText: "Example data" })).toContainText(/sample/i);
  await expect(phone.locator(".back")).toHaveText(section);
  await expect(phone.locator("[aria-current]", { hasText: "Home" })).toHaveCount(1);
  return figure;
};

test.describe("a person goes from Issues & Requests to an issue", () => {
  test("the person opens the Issues & Requests section from Home and then its drawings", async ({ page }) => {
    await openMockup(page, "menu.html");
    const figures = page.locator("figure");
    await shoot(figures.nth(0), journey, "home");
    await shoot(figures.nth(1), journey, "issues-and-requests-section");
    await page.locator("nav.jnav button.nb-link", { hasText: /^Menu$/ }).click();
    await page.locator('nav.jnav .nb-menu a[href="menu-issues.html"]').click();
    await page.waitForURL(/menu-issues\.html/);
    await expect(page.locator("figure#all-issues .phone")).toBeVisible();
  });

  for (const screen of screens) {
    test(`the person reads ${screen.step.replace(/-/g, " ")} with Back reading ${section}`, async ({ page }) => {
      await openMockup(page, "menu-issues.html");
      const figure = await readsOnFigure(page, screen.figure);
      await expect(figure.locator(".phone .bar-title")).toHaveText(screen.title);
      await shoot(figure, journey, screen.step);
    });
  }
});
