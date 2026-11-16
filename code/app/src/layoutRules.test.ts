import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = resolve(__dirname);
const featuresRoot = existsSync(join(srcRoot, "features")) ? join(srcRoot, "features") : srcRoot;
const nonFeatureFolders = new Set(["shared", "app", "features", "journeys", "home", "menu"]);
const featureFolders = new Set(
  readdirSync(featuresRoot).filter((name) => statSync(join(featuresRoot, name)).isDirectory() && !nonFeatureFolders.has(name)),
);
const guardedFeatures = ["backlogs", "files", "market"];
const featuresWithPublicIndex = guardedFeatures.filter(
  (name) => featureFolders.has(name) && (existsSync(join(featuresRoot, name, "index.ts")) || existsSync(join(featuresRoot, name, "index.tsx"))),
);
const foldersExemptFromPublicSurface = new Set(["journeys"]);

const sharedImportsOfFeaturesAndShell: string[] = [];

const deepImportsIntoFeaturesWithPublicIndex: string[] = [
  "TabBar.tsx -> market",
  "routes.ts -> market",
  "started/api.ts -> market",
  "started/done.ts -> market",
  "steps/api.ts -> market",
  "home/StartRows.tsx -> market",
  "inbox/needsYou.ts -> market",
  "inbox/useNeedsYou.ts -> market",
  "home/lastBacklog.ts -> backlogs",
  "inbox/assignedIssues.ts -> backlogs",
];

type Import = { file: string; line: number; target: string };

const sourceFilesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFilesUnder(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

const withoutGroupFolder = (absolute: string): string =>
  relative(srcRoot, absolute).split(sep).join("/").replace(/^(features|app)\//, "");

const importPattern = /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)["'](\.{1,2}(?:\/[^"']*)?)["']/gm;

const importsOf = (file: string): Import[] => {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(importPattern)].map((match) => ({
    file: withoutGroupFolder(file),
    line: text.slice(0, match.index).split("\n").length,
    target: withoutGroupFolder(resolve(dirname(file), match[1])),
  }));
};

const allImports = sourceFilesUnder(srcRoot).flatMap(importsOf);

const topOf = (path: string): string => path.split("/")[0];

const kindOf = (path: string): "shared" | "feature" | "shell" => {
  const top = topOf(path);
  if (top === "shared") return "shared";
  return featureFolders.has(top) ? "feature" : "shell";
};

const keyOf = (found: Import): string => `${found.file} -> ${found.target}`;

const featureKeyOf = (found: Import): string => `${found.file} -> ${topOf(found.target)}`;

const isIndexOnly = (target: string): boolean => {
  const rest = target.split("/").slice(1);
  return rest.length === 0 || (rest.length === 1 && /^index(\.tsx?)?$/.test(rest[0]));
};

const sharedImportsOfFeaturesAndShellFound = allImports.filter(
  (found) => kindOf(found.file) === "shared" && kindOf(found.target) !== "shared",
);

const deepImportsIntoFeaturesWithPublicIndexFound = allImports.filter(
  (found) =>
    kindOf(found.file) !== "shared" &&
    !foldersExemptFromPublicSurface.has(topOf(found.file)) &&
    kindOf(found.target) === "feature" &&
    featuresWithPublicIndex.includes(topOf(found.target)) &&
    topOf(found.file) !== topOf(found.target) &&
    !isIndexOnly(found.target),
);

const unlisted = (found: Import[], listed: string[], key: (one: Import) => string): string[] =>
  found.filter((one) => !listed.includes(key(one))).map((one) => `${one.file}:${one.line} imports ${one.target}`);

const staleEntries = (found: Import[], listed: string[], key: (one: Import) => string): string[] => {
  const present = new Set(found.map(key));
  return listed.filter((entry) => !present.has(entry));
};

describe("the folder strategy of phone-app-structure.md", () => {
  it("has no pages folder", () => {
    expect(existsSync(join(srcRoot, "pages"))).toBe(false);
    expect(existsSync(join(featuresRoot, "pages"))).toBe(false);
  });

  it("keeps shared from importing a feature or the shell, apart from the listed imports", () => {
    expect(unlisted(sharedImportsOfFeaturesAndShellFound, sharedImportsOfFeaturesAndShell, keyOf)).toEqual([]);
  });

  it("lists no shared import that has since been fixed", () => {
    expect(staleEntries(sharedImportsOfFeaturesAndShellFound, sharedImportsOfFeaturesAndShell, keyOf)).toEqual([]);
  });

  it("reaches a feature that has a public index only through that index, apart from the listed imports", () => {
    expect(unlisted(deepImportsIntoFeaturesWithPublicIndexFound, deepImportsIntoFeaturesWithPublicIndex, featureKeyOf)).toEqual([]);
  });

  it("lists no deep import that has since been fixed", () => {
    expect(staleEntries(deepImportsIntoFeaturesWithPublicIndexFound, deepImportsIntoFeaturesWithPublicIndex, featureKeyOf)).toEqual([]);
  });

  it("guards the features that have a public index today", () => {
    expect(featuresWithPublicIndex.length).toBeGreaterThan(0);
  });
});
