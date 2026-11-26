import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const mockRoot = dirname(fileURLToPath(import.meta.url));
export const consoleSrc = resolve(mockRoot, "../../../../code/console/src");

export { existsSync };

export const read = (path) => readFileSync(path, "utf8");
export const rel = (path) => relative(mockRoot, path);
export const lineOf = (text, index) => text.slice(0, index).split("\n").length;

export const htmlFiles = (dir = mockRoot) =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? htmlFiles(join(dir, entry.name))
        : entry.name.endsWith(".html")
          ? [join(dir, entry.name)]
          : [],
    )
    .sort();

export const report = (findings) => {
  if (findings.length) {
    console.log(findings.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("ok");
  }
};

export const menuJs = () =>
  vm.runInNewContext(read(join(mockRoot, "menu.js")) + "\n;({ ENTRIES, DETAILS, SIGN_OUT })", {});

const closers = { "[": "]", "{": "}" };

const balanced = (text, open) => {
  const close = closers[text[open]];
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === text[open]) depth++;
    else if (text[i] === close && --depth === 0) return text.slice(open, i + 1);
  }
  throw new Error("unbalanced " + text[open] + " at " + open);
};

const declaration = (text, name, opener) => {
  const found = new RegExp("\\bconst\\s+" + name + "\\b[^=\\n]*=\\s*\\" + opener).exec(text);
  if (!found) throw new Error("cannot find " + name);
  return balanced(text, found.index + found[0].length - 1);
};

const tsArray = (text, name, scope) =>
  vm.runInNewContext(
    "(" + declaration(text, name, "[").replace(/\bpermission:\s*\w+,?/g, "").replace(/\bas const\b/g, "") + ")",
    scope,
  );

export const menuTs = () => {
  const text = read(join(consoleSrc, "data/menu.ts"));
  const scope = {};
  for (const name of ["everyKind", "allButFarmers", "farmersOnly", "farmersAndOther", "reviewAreaPages", "hiddenPages"]) {
    scope[name] = tsArray(text, name, scope);
  }
  const entries = tsArray(text, "entries", scope).map((entry) => ({
    ...entry,
    hidden: scope.hiddenPages.includes(entry.id),
  }));
  return { entries };
};

export const viewIds = () => {
  const text = read(join(consoleSrc, "pages/views.ts"));
  return [...declaration(text, "views", "{").matchAll(/^\s*"?([\w-]+)"?\s*:/gm)].map((m) => m[1]);
};

const englishBlock = () => {
  const text = read(join(consoleSrc, "../public/i18n.json"));
  return text.slice(0, text.indexOf('"de": {'));
};

export const englishLabel = (id) => {
  const found = new RegExp('"menu\\.' + id + '"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")').exec(englishBlock());
  return found ? JSON.parse(found[1]) : undefined;
};

export const linksOf = (file) => {
  const text = read(file);
  return [...text.matchAll(/\b(?:href|src)=["']([^"']*)["']/g)].map((m) => ({
    target: m[1],
    line: lineOf(text, m.index),
  }));
};

export const localPath = (file, target) => {
  if (!target || target.startsWith("#") || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) return null;
  const clean = target.split(/[#?]/)[0];
  return clean ? resolve(dirname(file), clean) : null;
};

export const attr = (tag, name) => new RegExp("\\b" + name + '="([^"]*)"').exec(tag)?.[1];
