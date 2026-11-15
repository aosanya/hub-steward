import { test, expect, type Page } from "@playwright/test";
import { openMockup, shoot } from "./helpers/shoot";

const journey = "05-assets";
const section = "Assets & Works";
const captionRows = ["Landing", "Filled by", "Example data"];

const figure = (page: Page, id: string) => page.locator(`figure#${id}`);

const readScreen = async (page: Page, id: string, title: string, back: string, step: string) => {
  const screen = figure(page, id);
  await expect(screen).toHaveCount(1);
  const phone = screen.locator(".phone").first();
  await expect(phone.locator(".bar-title").first()).toHaveText(title);
  await expect(phone.locator(".back").first()).toContainText(back);
  await expect(phone.locator("[aria-current]").first()).toContainText("Home");
  const rows = await screen.locator(".cap-row dt").allTextContents();
  expect(rows).toEqual(expect.arrayContaining(captionRows));
  await shoot(screen, journey, step);
};

const submenus = [
  { id: "mun920", title: "Buildings", step: "buildings" },
  { id: "mun917", title: "Water Points", step: "water-points" },
  { id: "mun914", title: "Street Lights", step: "street-lights" },
  { id: "mun923", title: "Work Orders", step: "work-orders" },
  { id: "mun926", title: "Maintenance Schedule", step: "maintenance-schedule" },
];

test("a person goes from Home to Assets & Works and reads a road or path", async ({ page }) => {
  await test.step("Home shows an Assets & Works row and the page opens from it", async () => {
    await openMockup(page, "menu.html");
    const row = page.locator('a[href="menu-assets.html"]:visible').first();
    await expect(row).toBeVisible();
    await shoot(page.locator("figure").first(), journey, "home-with-section-rows");
    await row.click();
    await expect(page).toHaveURL(/menu-assets\.html$/);
    await page.waitForSelector(".phone");
  });

  await test.step("Roads & Paths lists roads and paths", async () => {
    await readScreen(page, "fig-roads-paths", "Roads & Paths", section, "roads-and-paths");
  });

  await test.step("a row opens one road, with Back reading Roads & Paths", async () => {
    await readScreen(page, "mun911", "Mill Street", "Roads & Paths", "a-road-or-path");
  });

  for (const submenu of submenus) {
    await test.step(`${submenu.title} has a drawing`, async () => {
      if ((await figure(page, submenu.id).count()) === 0) {
        test.info().annotations.push({ type: "missing", description: `${submenu.title} drawing is not on the page` });
        return;
      }
      await readScreen(page, submenu.id, submenu.title, section, submenu.step);
    });
  }

  test.info().annotations
    .filter((annotation) => annotation.type === "missing")
    .forEach((annotation) => expect.soft(annotation.description, "drawing missing").toBeUndefined());
});
