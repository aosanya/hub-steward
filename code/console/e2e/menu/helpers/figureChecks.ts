import { expect, type Locator, type Page } from "@playwright/test";

export const expectCaptionRows = async (figure: Locator) => {
  const labels = await figure.locator(".cap-rows dt").allTextContents();
  ["Landing", "Filled by", "Example data"].forEach((label) => expect(labels).toContain(label));
};

export const expectSampleMarked = async (figure: Locator) => {
  await expect(figure.locator(".phone, .win").first()).toContainText(/sample/i);
};

export const expectBackReads = async (figure: Locator, section: string) => {
  await expect(figure.locator(".phone .back, .win .back").first()).toHaveText(section);
};

export const expectHomeChosen = async (figure: Locator) => {
  await expect(figure.locator(".phone .tabs, .win .tabs").first()).toHaveAttribute("data-chosen", "home");
};

export const openSectionFromMenu = async (page: Page, sectionFile: string) => {
  await page.locator(`p.intro a[href="${sectionFile}"]`).click();
  await page.waitForSelector(".phone");
  expect(page.url()).toContain(sectionFile);
};
