import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const owned = new Set([".bar", ".bar-action", ".bar-title", ".bar-agency", ".back", ".act", ".title", ".menu-btn", ".body", ".head", ".headline", ".sub", ".tabs", ".tab", ".rows", ".row", ".btn", ".chip", ".card", ".input", ".field", ".flabel", ".bottombar", ".icon"]);
const tokenName = /--(r-sm|r-md|r-pill|bg|bg-alt|surface|ink|ink-soft|line|line-strong|accent|accent-strong|accent-wash|on-accent|danger|success|info|info-wash|sans|mono)\s*:/;

function htmlFiles(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : htmlFiles(full);
    return extname(entry.name) === ".html" ? [full] : [];
  });
}

const styleOf = (html) => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");

function rulesOf(css) {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...flat.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1].trim(), body: match[2] }));
}

function problems(file) {
  const html = readFileSync(file, "utf8");
  const found = [];
  if (html.trim() === "") return ["the file is empty"];
  if (!/shared\/app-real\.css/.test(html)) found.push("does not link shared/app-real.css");
  const rules = rulesOf(styleOf(html));
  for (const rule of rules) {
    if (/^:root$/.test(rule.selector) && (/font-size/.test(rule.body) || tokenName.test(rule.body))) found.push(":root restates the app's size or tokens");
    if (rule.selector === "body" && /font-|line-height|(^|;)\s*color/.test(rule.body)) found.push("body restates the app font or colour");
    if (owned.has(rule.selector)) found.push(`redefines ${rule.selector}, which the real app css draws`);
    if (/font-size\s*:\s*[0-9.]+px/.test(rule.body)) found.push(`pixel font size in ${rule.selector}`);
    if (/border-radius\s*:\s*[^;]*[0-9.]+(px|rem|em)/.test(rule.body) && !/var\(--r-/.test(rule.body)) found.push(`fixed border radius in ${rule.selector}`);
  }
  for (const bar of html.matchAll(/<header class="bar"([^>]*)>/g)) if (!/data-(title|back)=/.test(bar[1])) found.push("a header.bar is hand drawn, use data-back, data-title, data-agency");
  if (/<header class="bar"/.test(html) && !/shared\/app-top\.js|app-top\.js/.test(html)) found.push("does not load app-top.js");
  for (const tabs of html.matchAll(/<(?:nav|div)[^>]*class="tabs"([^>]*)>/g)) if (!/data-tabs/.test(tabs[0])) found.push("a tab bar is hand drawn, use nav.tabs[data-tabs]");
  if (/data-tabs/.test(html) && !/app-bar\.js/.test(html)) found.push("does not load app-bar.js");
  return [...new Set(found)];
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node check-sync.mjs <html file or folder>...");
  process.exit(2);
}

let failing = 0;
for (const file of targets.flatMap(htmlFiles).sort()) {
  const found = problems(file);
  if (found.length > 0) {
    failing += 1;
    console.log(`${file}\n  - ${found.join("\n  - ")}`);
  }
}
console.log(failing === 0 ? "every mockup is in sync with the real app css" : `${failing} mockups out of sync`);
process.exit(failing === 0 ? 0 : 1);
