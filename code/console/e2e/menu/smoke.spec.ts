import { test, expect } from "@playwright/test";
import { openMockup, shoot } from "./helpers/shoot";

test("a person opens the menu drawings and the first screen is saved to QA", async ({ page }) => {
  await openMockup(page, "menu.html");
  const path = await shoot(page.locator("figure").first(), "00-smoke", "menu-screen-1");
  expect(path).toContain("03-screenshots/menu/00-smoke/01-menu-screen-1.png");
});
