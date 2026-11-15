import { test, expect } from "@playwright/test";
import { expectBackReads, expectCaptionRows, expectSampleMarked, openSectionFromMenu } from "./helpers/figureChecks";
import { figureAt, openMockup, shoot } from "./helpers/shoot";

const journey = "09-settings";

const screens = [
  { anchor: "municipality-profile", step: "municipality-profile" },
  { anchor: "users-and-roles", step: "users-and-roles" },
  { anchor: "mun932", step: "boundaries-and-wards" },
  { anchor: "mun934", step: "integrations" },
  { anchor: "mun936", step: "audit-log" },
];

test("Settings is drawn on Home only beside another section", async ({ page }) => {
  await openMockup(page, "menu.html");
  const homes = page.locator("figure").filter({ has: page.locator(".ttl", { hasText: /^Settings$/ }) });
  await expect(homes).not.toHaveCount(0);
  const titles = await homes.first().locator(".phone .row .ttl").allTextContents();
  const sections = titles.filter((title) => !["Start", "Ongoing", "Backlogs", "Settings"].includes(title.trim()));
  expect(sections.length).toBeGreaterThan(0);
});

test("a person goes from Home to Settings, reads Municipality Profile, then opens the other four screens", async ({ page }) => {
  await test.step("Home lists Settings and the row opens the Settings page", async () => {
    await openMockup(page, "menu.html");
    const home = page.locator("figure").first();
    await expect(home.locator(".ttl", { hasText: /^Settings$/ })).toBeVisible();
    await shoot(home, journey, "home-with-settings");
    await openSectionFromMenu(page, "menu-settings.html");
  });

  for (const { anchor, step } of screens) {
    await test.step(`open ${step}`, async () => {
      const figure = figureAt(page, anchor);
      await expectCaptionRows(figure);
      await expectSampleMarked(figure);
      await expectBackReads(figure, "Settings");
      await shoot(figure, journey, step);
    });
  }
});
