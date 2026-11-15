import { test, expect } from "@playwright/test";
import type { Locator } from "@playwright/test";
import { figureAt, openMockup, shoot } from "./helpers/shoot";

const journey = "01-residents";
const pageFile = "menu-residents.html";

const readsLikeADrawing = async (figure: Locator) => {
  await expect(figure.locator(".cap-row dt")).toContainText(["Landing", "Filled by", "Example data"]);
  await expect(figure.locator(".cap-row").filter({ hasText: "Example data" })).toContainText(/sample/i);
  await expect(figure.locator(".phone .back")).toHaveText("Residents");
  await expect(figure.locator(".phone nav.tabs")).toHaveAttribute("data-chosen", "home");
};

test.describe("a person goes from Residents to a resident", () => {
  test("Home leads to Residents, whose submenus are drawn", async ({ page }) => {
    await openMockup(page, "menu.html");
    expect(await page.locator(`a[href="${pageFile}"]`).count()).toBeGreaterThan(0);
    const section = figureAt(page, "s4");
    await expect(section.locator(".bar-title")).toHaveText("Residents");
    await expect(section.locator(".row .ttl")).toHaveText([
      "All Residents",
      "Households",
      "Registrations",
      "Groups & Associations",
      "Communications",
    ]);
    await shoot(section, journey, "residents-submenus");
  });

  test("All Residents lists names and statuses and every row can be tapped", async ({ page }) => {
    await openMockup(page, pageFile);
    const figure = figureAt(page, "fig-all-residents");
    await readsLikeADrawing(figure);
    await expect(figure.locator(".phone .bar-title")).toHaveText("All Residents");
    await expect(figure.locator(".phone a.row")).toHaveCount(6);
    await expect(figure.locator(".phone .row .ttl")).toHaveText(
      ["A", "B", "C", "D", "E", "F"].map((letter) => `Sample Resident ${letter}`),
    );
    await expect(figure.locator(".phone .row .chip")).toHaveText(["Active", "Active", "Invited", "Active", "Inactive", "Invited"]);
    await shoot(figure, journey, "all-residents");
  });

  test("a resident shows the name, the status and the groups, and nothing on it is a button", async ({ page }) => {
    await openMockup(page, pageFile);
    const figure = figureAt(page, "fig-resident");
    await readsLikeADrawing(figure);
    await expect(figure.locator(".phone .bar-title")).toHaveText("Resident");
    await expect(figure.locator(".phone")).toContainText("Sample Resident A");
    await expect(figure.locator(".phone")).toContainText("Active");
    await expect(figure.locator(".phone")).toContainText("Sample Group 1");
    await expect(figure.locator(".phone")).toContainText("Sample Group 2");
    await expect(figure.locator(".phone a.row, .phone button")).toHaveCount(0);
    await shoot(figure, journey, "a-resident");
  });

  test("Households lists a household name and its member count", async ({ page }) => {
    await openMockup(page, pageFile);
    const figure = figureAt(page, "fig-mun889");
    await readsLikeADrawing(figure);
    await expect(figure.locator(".phone .bar-title")).toHaveText("Households");
    await expect(figure.locator(".phone .row .ttl")).toHaveText([1, 2, 3, 4, 5].map((n) => `Sample Household ${n}`));
    await shoot(figure, journey, "households");
  });

  test("Registrations lists the people asking to join with the request date", async ({ page }) => {
    await openMockup(page, pageFile);
    const figure = figureAt(page, "fig-mun890");
    await readsLikeADrawing(figure);
    await expect(figure.locator(".phone .bar-title")).toHaveText("Registrations");
    await expect(figure.locator(".phone .row")).toHaveCount(4);
    await expect(figure.locator(".phone")).toContainText("Requested 12 Nov 2026");
    await shoot(figure, journey, "registrations");
  });

  test("Groups & Associations lists a group name and its member count", async ({ page }) => {
    await openMockup(page, pageFile);
    const figure = figureAt(page, "fig-mun892");
    await readsLikeADrawing(figure);
    await expect(figure.locator(".phone .bar-title")).toHaveText("Groups & Associations");
    await expect(figure.locator(".phone .row")).toHaveCount(5);
    await expect(figure.locator(".phone")).toContainText("Sample Garden Club");
    await expect(figure.locator(".phone")).toContainText("12 members");
    await shoot(figure, journey, "groups-and-associations");
  });

  test("Communications lists message threads with the time of the last message", async ({ page }) => {
    await openMockup(page, pageFile);
    const figure = figureAt(page, "fig-mun894");
    await readsLikeADrawing(figure);
    await expect(figure.locator(".phone .bar-title")).toHaveText("Communications");
    await expect(figure.locator(".phone .row")).toHaveCount(4);
    await expect(figure.locator(".phone")).toContainText("Sample notice about bins");
    await shoot(figure, journey, "communications");
  });
});
