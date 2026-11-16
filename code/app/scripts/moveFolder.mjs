import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

const usage = "usage: node scripts/moveFolder.mjs <from> <to> [--dry]   (paths under src, run from code/app)";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const [from, to] = args.filter((arg) => arg !== "--dry");

if (!from || !to) {
  console.error(usage);
  process.exit(2);
}

const src = resolve("src");
const fromAbs = resolve(src, from);
const toAbs = resolve(src, to);

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!existsSync(fromAbs) || !statSync(fromAbs).isDirectory()) fail(`${from} is not a folder under src`);
if (existsSync(toAbs)) fail(`${to} already exists`);
if (toAbs.startsWith(fromAbs + sep)) fail(`${to} is inside ${from}`);

const sourceFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });

const shown = (path) => relative(src, path);
const insideFrom = (path) => path === fromAbs || path.startsWith(fromAbs + sep);
const afterMove = (path) => (insideFrom(path) ? join(toAbs, relative(fromAbs, path)) : path);

const specifier = /(\bfrom\s*|\bimport\s*\(?\s*|\bvi\.(?:mock|doMock|unmock|importActual|importMock|requireActual)\s*\(\s*|\brequire\s*\(\s*|@import\s+)(["'])(\.{1,2}(?:\/[^"'\n]*)?)\2/g;

const genericCall = /(\bvi\.(?:importActual|importMock|requireActual)\s*<(?:[^<>]|<[^<>]*>)*>\s*\(\s*)(["'])(\.{1,2}(?:\/[^"'\n]*)?)\2/g;

const relativeSpecifier = (fromDir, target, original) => {
  const rel = relative(fromDir, target).split(sep).join("/");
  const prefixed = rel.startsWith(".") ? rel : `./${rel}`;
  return original.endsWith("/") && !prefixed.endsWith("/") ? `${prefixed}/` : prefixed;
};

const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const literalFrom = new RegExp(`(^|/)${escaped}(?=/|$)`);

const keepStyle = (spec, newDir, oldDir, movedTarget) => {
  if (newDir !== oldDir || !literalFrom.test(spec)) return null;
  const candidate = spec.replace(literalFrom, `$1${to}`);
  return normalize(resolve(newDir, candidate)) === movedTarget ? candidate : null;
};

const rewrite = (file, text) => {
  const oldDir = dirname(file);
  const newDir = dirname(afterMove(file));
  const replace = (whole, lead, quote, spec) => {
    const target = normalize(resolve(oldDir, spec));
    const movedTarget = afterMove(target);
    if (relative(oldDir, target) === relative(newDir, movedTarget)) return whole;
    const kept = keepStyle(spec, newDir, oldDir, movedTarget);
    return `${lead}${quote}${kept ?? relativeSpecifier(newDir, movedTarget, spec)}${quote}`;
  };
  return text.replace(specifier, replace).replace(genericCall, replace);
};

const pathString = /(["'`])(\.{1,2}\/[^"'`\n]*)\1/g;

const leftovers = (file, text) => {
  const rest = text.replace(specifier, "").replace(genericCall, "");
  const moved = afterMove(file) !== file;
  return [...rest.matchAll(pathString)]
    .filter(([, , str]) => moved || insideFrom(normalize(resolve(dirname(file), str))))
    .map(([, , str]) => `${shown(file)}: "${str}"`);
};

const files = sourceFiles(src);
const plan = files.flatMap((file) => {
  const text = readFileSync(file, "utf8");
  const next = rewrite(file, text);
  return next === text ? [] : [{ file, target: afterMove(file), next }];
});
const strays = files.flatMap((file) => leftovers(file, readFileSync(file, "utf8")));

if (dry) {
  plan.forEach(({ file }) => console.log(`would rewrite ${shown(file)}`));
  strays.forEach((line) => console.log(`check by hand: ${line}`));
  console.log(`${plan.length} files would change; ${from} would move to ${to}`);
  process.exit(0);
}

mkdirSync(dirname(toAbs), { recursive: true });
execFileSync("git", ["mv", fromAbs, toAbs], { stdio: "inherit" });
plan.forEach(({ target, next }) => writeFileSync(target, next));
plan.forEach(({ target }) => console.log(`rewrote ${shown(target)}`));
console.log(`${plan.length} files rewritten; ${from} moved to ${to}`);
strays.forEach((line) => console.log(`check by hand: ${line}`));

const search = spawnSync(
  "grep",
  ["-rIl", "--exclude-dir=node_modules", "--exclude-dir=dist", "--exclude-dir=dist-qa", "--exclude-dir=dist-staging", `src/${from}`, "."],
  { encoding: "utf8" },
);
const mentions = search.stdout.trim();
if (mentions) console.log(`still names src/${from}, check by hand:\n${mentions}`);
