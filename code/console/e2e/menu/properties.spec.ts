import { test, expect, type Page } from "@playwright/test";
import { openMockup, shoot } from "./helpers/shoot";

const journey = "02-properties";
const section = "Properties & Addresses";

const screens = [
  { figure: "fig-mun897", title: "Properties", step: "properties-list" },
  { figure: "fig-mun900", title: "Properties", step: "a-property" },
  { figure: "fig-mun903", title: "Addresses", step: "addresses" },
  { figure: "fig-mun906", title: "Ownership & Tenure", step: "ownership-and-tenure" },
  { figure: "fig-mun909", title: "Land Use & Zoning", step: "land-use-and-zoning" },
];

const readsOnFigure = async (page: Page, figureId: string) => {
  const figure = page.locator(`figure#${figureId}`);
  const phone = figure.locator(".phone");
  await expect(figure.locator(".cap-row dt", { hasText: "Landing" })).toHaveCount(1);
  await expect(figure.locator(".cap-row dt", { hasText: "Filled by" })).toHaveCount(1);
  await expect(figure.locator(".cap-row dt", { hasText: "Example data" })).toHaveCount(1);
  await expect(figure.locator(".cap-row", { hasText: "Example data" })).toContainText(/invented sample|sample/i);
  await expect(phone.locator(".back")).toHaveText(section);
  await expect(phone.locator("[aria-current]", { hasText: "Home" })).toHaveCount(1);
  return figure;
};

test.describe("a person goes from Properties & Addresses to a property", () => {
  test("the person sees Home and opens the Properties & Addresses drawings from the menu page", async ({ page }) => {
    await openMockup(page, "menu.html");
    await shoot(page.locator("figure").first(), journey, "home");
    await page.locator("nav.jnav button.nb-link", { hasText: /^Menu$/ }).click();
    await page.locator('nav.jnav .nb-menu a[href="menu-properties.html"]').click();
    await page.waitForURL(/menu-properties\.html/);
    await expect(page.locator("figure#fig-mun897 .phone")).toBeVisible();
  });

  for (const screen of screens) {
    test(`the person reads ${screen.step.replace(/-/g, " ")} with Back reading ${section}`, async ({ page }) => {
      await openMockup(page, "menu-properties.html");
      const figure = await readsOnFigure(page, screen.figure);
      await expect(figure.locator(".phone .bar-title")).toHaveText(screen.title);
      await shoot(figure, journey, screen.step);
    });
  }
});
