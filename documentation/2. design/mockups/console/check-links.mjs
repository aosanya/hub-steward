import { join } from "node:path";
import { attr, existsSync, htmlFiles, linksOf, localPath, menuJs, mockRoot, read, rel, report } from "./check-lib.mjs";

const { ENTRIES, DETAILS } = menuJs();
const agencies = ["farmers", "lab", "riders"];
const currents = new Set([...ENTRIES.map((e) => e.id), ...Object.keys(DETAILS)]);
const findings = [];

for (const file of htmlFiles()) {
  const name = rel(file);
  const text = read(file);

  for (const { target, line } of linksOf(file)) {
    const path = localPath(file, target);
    if (path && !existsSync(path)) findings.push(`${name}:${line}: missing ${target}`);
  }

  const navs = [...text.matchAll(/<nav\b[^>]*>/g)].filter((m) => (attr(m[0], "class") ?? "").split(/\s+/).includes("side"));
  for (const nav of navs) {
    const line = text.slice(0, nav.index).split("\n").length;
    const agency = attr(nav[0], "data-agency");
    const current = attr(nav[0], "data-current");
    if (!agencies.includes(agency)) findings.push(`${name}:${line}: nav.side data-agency "${agency}" is not farmers, lab or riders`);
    if (current !== undefined && !currents.has(current)) findings.push(`${name}:${line}: nav.side data-current "${current}" is not a menu id or detail key`);
  }

  const scripts = [...text.matchAll(/<script\b[^>]*\bsrc=["']([^"']*)["']/g)].map((m) => m[1]);
  const prefix = "../".repeat(name.split("/").length - 1);
  const loaders = scripts.filter((src) => /(^|\/)(shell|menu)\.js$/.test(src));
  if (navs.length && loaders.length === 0) findings.push(`${name}: nav.side without the shell.js script tag, expected ${prefix}shell.js`);
  for (const src of loaders) if (src !== prefix + "shell.js") findings.push(`${name}: script src "${src}", expected ${prefix}shell.js`);

  const strips = [...text.matchAll(/<header class="strip"[^>]*>/g)];
  for (const strip of strips) {
    const line = text.slice(0, strip.index).split("\n").length;
    if (attr(strip[0], "data-hub") === undefined) findings.push(`${name}:${line}: header.strip is not the shared component (no data-hub)`);
  }
  for (const strip of strips) {
    const line = text.slice(0, strip.index).split("\n").length;
    const crumb = (attr(strip[0], "data-crumb") ?? "").replace(/&amp;/g, "&");
    if (/[<>]|&lt;|&gt;|&quot;/.test(crumb)) findings.push(`${name}:${line}: data-crumb holds markup: ${crumb.slice(0, 60)}`);
    for (const part of crumb.split(" / ").slice(0, -1)) {
      const href = part.split("=")[1];
      if (href && !existsSync(localPath(join(mockRoot, "x.html"), href))) findings.push(`${name}:${line}: data-crumb link ${href} does not exist`);
    }
  }
  const chats = [...text.matchAll(/<aside class="chat"[^>]*>/g)];
  for (const chat of chats) {
    const line = text.slice(0, chat.index).split("\n").length;
    if (attr(chat[0], "data-ctx") === undefined) findings.push(`${name}:${line}: aside.chat is not the shared component (no data-ctx)`);
  }
}

report(findings);
