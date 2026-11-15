import { test, expect } from "@playwright/test";
import { expectBackReads, expectCaptionRows, expectHomeChosen, expectSampleMarked, openSectionFromMenu } from "./helpers/figureChecks";
import { figureAt, openMockup, shoot } from "./helpers/shoot";

const journey = "08-finance";

const submenus = [
  { anchor: "mun916", step: "revenue-and-billing" },
  { anchor: "mun919", step: "procurement" },
  { anchor: "mun922", step: "payments" },
  { anchor: "mun925", step: "financial-reports" },
];

test("a person goes from Home to Finance, reads Budget and a budget line, then opens the other four submenus", async ({ page }) => {
  await test.step("Home lists Finance and the row opens the Finance page", async () => {
    await openMockup(page, "menu.html");
    const home = page.locator("figure").first();
    await expect(home.locator(".ttl", { hasText: /^Finance$/ })).toBeVisible();
    await shoot(home, journey, "home-with-finance");
    await openSectionFromMenu(page, "menu-finance.html");
  });

  await test.step("Budget on the phone", async () => {
    const budget = figureAt(page, "fig-budget");
    await expectCaptionRows(budget);
    await expectSampleMarked(budget);
    await expectBackReads(budget, "Finance");
    await shoot(budget, journey, "budget");
  });

  await test.step("a budget line opens from a Budget row", async () => {
    const line = figureAt(page, "mun913");
    await expectCaptionRows(line);
    await expectSampleMarked(line);
    await expectBackReads(line, "Finance");
    await expectHomeChosen(line);
    await shoot(line, journey, "budget-line");
  });

  for (const { anchor, step } of submenus) {
    await test.step(`Back to Finance and open ${step}`, async () => {
      const figure = figureAt(page, anchor);
      await expectCaptionRows(figure);
      await expectSampleMarked(figure);
      await expectBackReads(figure, "Finance");
      await expectHomeChosen(figure);
      await shoot(figure, journey, step);
    });
  }
});

test.fixme("MUN950: Budget on the wide drawing carries its caption rows and a sample and is saved to QA", async ({ page }) => {
  await openMockup(page, "menu-finance.html");
  const wide = figureAt(page, "fig-budget-wide");
  await expectCaptionRows(wide);
  await expectSampleMarked(wide);
  await expectBackReads(wide, "Finance");
  await shoot(wide, journey, "budget-wide");
});
