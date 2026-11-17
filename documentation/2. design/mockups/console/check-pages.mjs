import { basename, join } from "node:path";
import { existsSync, htmlFiles, linksOf, localPath, menuJs, mockRoot, rel, report, viewIds } from "./check-lib.mjs";

const { ENTRIES, DETAILS, SIGN_OUT } = menuJs();
const byId = new Map(ENTRIES.map((e) => [e.id, e]));
const views = viewIds();
const menuRows = ENTRIES.filter((e) => !e.hidden && e.kinds.length).map((e) => e.id);
const findings = [];

for (const id of new Set([...views, ...menuRows])) {
  const entry = byId.get(id);
  const where = views.includes(id) ? "console view" : "menu row";
  if (!entry) findings.push(`${id}: ${where} has no menu.js entry`);
  else if (!entry.href) findings.push(`${id}: ${where} has no mockup href in menu.js`);
  else if (!existsSync(join(mockRoot, entry.href))) findings.push(`${id}: ${where} links ${entry.href}, which does not exist`);
}

const files = htmlFiles();
const indexFile = join(mockRoot, "index.html");
const pointedAt = new Set([
  ...ENTRIES.map((e) => e.href),
  SIGN_OUT.href,
  ...linksOf(indexFile).map((l) => localPath(indexFile, l.target)).filter(Boolean).map(rel),
  ...files.filter((f) => Object.keys(DETAILS).includes(basename(f, ".html"))).map(rel),
]);

files
  .filter((f) => f !== indexFile && !pointedAt.has(rel(f)))
  .forEach((f) => findings.push(`${rel(f)}: orphan, no menu row, detail mapping or index.html entry points at it`));

report(findings);
