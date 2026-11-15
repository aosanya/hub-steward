import { test, expect, type Locator } from "@playwright/test";
import { figureAt, openMockup, shoot } from "./helpers/shoot";

const journey = "07-staff";
const section = "Staff & Departments";

const expectDrawnLikeTheOthers = async (figure: Locator, backReads: string) => {
  await expect(figure.locator("dt")).toHaveText(["Landing", "Filled by", "Example data"]);
  await expect(figure.locator(".cap-row", { hasText: "Example data" }).locator("dd")).toContainText(/sample/i);
  await expect(figure.locator(".phone .back")).toHaveText(backReads);
  await expect(figure.locator(".phone .tabs")).toHaveAttribute("data-chosen", "home");
};

test("a person goes from Home to Staff & Departments and reads a staff member, then the other three screens", async ({ page }) => {
  await openMockup(page, "menu.html");
  await expect(page.locator(".phone").first().getByText(section)).toBeVisible();
  await shoot(page.locator("figure").first(), journey, "home-lists-staff-and-departments");

  await page.getByRole("link", { name: /Staff & Departments: the Staff screen/ }).click();
  await page.waitForSelector(".phone");
  await expect(page).toHaveURL(/menu-staff\.html$/);

  const staff = figureAt(page, "fig-staff");
  await expectDrawnLikeTheOthers(staff, section);
  await expect(staff.locator(".phone .bar-title")).toHaveText("Staff");
  const firstName = (await staff.locator(".phone .row .ttl").first().textContent()) ?? "";
  await shoot(staff, journey, "staff-list");

  const member = figureAt(page, "mun898");
  await expectDrawnLikeTheOthers(member, "Staff");
  await expect(member.locator(".phone .dh")).toHaveText(firstName);
  await shoot(member, journey, "a-staff-member");

  const others = [
    { anchor: "mun901", title: "Departments", step: "departments" },
    { anchor: "mun904", title: "Crews", step: "crews" },
    { anchor: "mun907", title: "Roles & Permissions", step: "roles-and-permissions" },
  ];
  for (const other of others) {
    const figure = figureAt(page, other.anchor);
    await expectDrawnLikeTheOthers(figure, section);
    await expect(figure.locator(".phone .bar-title")).toHaveText(other.title);
    await shoot(figure, journey, other.step);
  }
});
