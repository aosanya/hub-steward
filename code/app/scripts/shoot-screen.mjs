import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";

const [route, target] = process.argv.slice(2);
if (!route || !target) {
  console.error("usage: node scripts/shoot-screen.mjs <route> <output.png>");
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const { chromium } = createRequire(join(appRoot, "..", "console", "package.json"))("playwright");

const distDir = join(tmpdir(), `shoot-screen-dist-${process.pid}`);
await build({ root: appRoot, logLevel: "warn", build: { outDir: distDir, emptyOutDir: true } });
const server = await preview({ root: appRoot, logLevel: "warn", build: { outDir: distDir }, preview: { port: 0, host: "127.0.0.1" } });
const base = server.resolvedUrls.local[0].replace(/\/$/, "");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(`${base}${route}`);
await page.waitForTimeout(800);
const tabBars = await page.getByRole("navigation", { name: "Main" }).count();
await page.screenshot({ path: resolve(target) });
console.log(`${resolve(target)} tab bars on screen: ${tabBars}`);
await browser.close();
await server.close();
