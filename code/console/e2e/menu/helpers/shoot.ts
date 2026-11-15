import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Locator, Page } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../..");
const mockupsDir = resolve(repoRoot, "documentation/2. design/mockups/app");
const screenshotsDir = resolve(repoRoot, "documentation/4. qa/testing/03-screenshots/menu");

const shotsTaken = new Map<string, number>();

export const openMockup = async (page: Page, file: string) => {
  await page.goto(pathToFileURL(resolve(mockupsDir, file)).href, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".phone");
};

export const figureAt = (page: Page, anchorId: string): Locator =>
  page.locator(`#${anchorId} + main figure, figure#${anchorId}`).first();

export const shoot = async (target: Locator, journey: string, step: string): Promise<string> => {
  const folder = resolve(screenshotsDir, journey);
  if (!shotsTaken.has(journey)) {
    mkdirSync(folder, { recursive: true });
    readdirSync(folder).filter((name) => name.endsWith(".png")).forEach((name) => rmSync(resolve(folder, name)));
    shotsTaken.set(journey, 0);
  }
  const number = (shotsTaken.get(journey) ?? 0) + 1;
  shotsTaken.set(journey, number);
  const path = resolve(folder, `${String(number).padStart(2, "0")}-${step}.png`);
  await target.locator(".phone").first().screenshot({ path });
  return path;
};
