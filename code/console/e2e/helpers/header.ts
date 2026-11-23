import type { Locator, Page } from "@playwright/test";

const toggleOf = (page: Page): Locator => page.locator(".top .actions > button");

export const headerAction = async (page: Page, name: string): Promise<Locator> => {
  const toggle = toggleOf(page);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return page.getByRole("menuitem", { name, exact: true });
};

export const hasHeaderAction = async (page: Page, name: string): Promise<boolean> => {
  const toggle = toggleOf(page);
  if ((await toggle.count()) === 0) return false;
  const shown = await (await headerAction(page, name)).isVisible();
  await toggle.click();
  return shown;
};
