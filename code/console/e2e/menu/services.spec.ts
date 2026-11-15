import { test, expect, type Page } from "@playwright/test";
import { openMockup, shoot } from "./helpers/shoot";

const journey = "04-services";
const section = "Services & Permits";
const captionRows = ["Landing", "Filled by", "Example data"];

const figure = (page: Page, id: string) => page.locator(`figure#${id}`);

const readScreen = async (page: Page, id: string, title: string, step: string) => {
  const screen = figure(page, id);
  await expect(screen).toHaveCount(1);
  const phone = screen.locator(".phone").first();
  await expect(phone.locator(".bar-title").first()).toHaveText(title);
  await expect(phone.locator(".back").first()).toContainText(section);
  await expect(phone.locator("[aria-current]").first()).toContainText("Home");
  const rows = await screen.locator(".cap-row dt").allTextContents();
  expect(rows).toEqual(expect.arrayContaining(captionRows));
  await shoot(screen, journey, step);
  return screen;
};

test("a person goes from Home to Services & Permits and reads every submenu screen", async ({ page }) => {
  await test.step("Home shows a Services & Permits row and the page opens from it", async () => {
    await openMockup(page, "menu.html");
    const row = page.locator('a[href="menu-services.html"]:visible').first();
    await expect(row).toBeVisible();
    await shoot(page.locator("figure").first(), journey, "home-with-section-rows");
    await row.click();
    await expect(page).toHaveURL(/menu-services\.html$/);
    await page.waitForSelector(".phone");
  });

  await test.step("Applications lists forms waiting, grouped Closes this week and Later", async () => {
    const screen = await readScreen(page, "applications-waiting", "Forms", "applications");
    await expect(screen.locator(".phone").first().getByRole("heading", { name: "Closes this week", exact: true })).toBeVisible();
    await expect(screen.locator(".phone").first().getByRole("heading", { name: "Later", exact: true })).toBeVisible();
  });

  await test.step("a row opens one application with Your answers", async () => {
    const screen = await readScreen(page, "application", "Application", "an-application");
    await expect(screen.locator(".phone").first().getByRole("heading", { name: "Your answers", exact: true })).toBeVisible();
  });

  await test.step("Permits lists the person's permit applications", async () => {
    await readScreen(page, "mun896", "Permits", "permits");
  });

  await test.step("Licences lists the person's licences", async () => {
    await readScreen(page, "mun899", "Licences", "licences");
  });

  await test.step("Fees & Payments groups Still to pay and Paid", async () => {
    const screen = await readScreen(page, "mun902", "Fees", "fees-and-payments");
    await expect(screen.locator(".phone").first().getByRole("heading", { name: "Still to pay", exact: true })).toBeVisible();
    await expect(screen.locator(".phone").first().getByRole("heading", { name: "Paid", exact: true })).toBeVisible();
  });

  await test.step("Service Catalogue lists the services offered", async () => {
    await readScreen(page, "mun905", "Service Catalogue", "service-catalogue");
  });
});
