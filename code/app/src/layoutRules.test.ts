import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = resolve(__dirname);
const featuresRoot = existsSync(join(srcRoot, "features")) ? join(srcRoot, "features") : srcRoot;
const nonFeatureFolders = new Set(["shared", "app", "features", "journeys", "home", "menu"]);
const featureFolders = new Set(
  readdirSync(featuresRoot).filter((name) => statSync(join(featuresRoot, name)).isDirectory() && !nonFeatureFolders.has(name)),
);
const featuresWithPublicIndex = [...featureFolders].filter(
  (name) => existsSync(join(featuresRoot, name, "index.ts")) || existsSync(join(featuresRoot, name, "index.tsx")),
);
const foldersExemptFromPublicSurface = new Set(["journeys"]);

const sharedImportsOfFeaturesAndShell: string[] = [
  "shared/ui/AgeBubble.tsx -> entry/language",
  "shared/ui/JoinForm.tsx -> market/shared/unitWords",
  "shared/ui/LanguageChoice.tsx -> entry/language",
  "shared/ui/LanguageChoice.tsx -> entry/words",
  "shared/ui/Shell.tsx -> inbox/api",
  "shared/ui/TabBar.tsx -> agency/open",
  "shared/ui/TabBar.tsx -> chat/unread.css",
  "shared/ui/TabBar.tsx -> inbox/api",
  "shared/ui/TabBar.tsx -> inbox/assignedIssues",
  "shared/ui/TabBar.tsx -> inbox/thingsToDo",
  "shared/ui/TabBar.tsx -> inbox/useNeedsYou",
  "shared/ui/TabBar.tsx -> market/start/api",
  "shared/ui/TabBar.tsx -> tabs",
  "shared/ui/TabPage.tsx -> tabs",
  "shared/ui/TopBar.test.tsx -> agency/open",
  "shared/ui/TopBar.tsx -> agency/open",
  "shared/ui/age.test.ts -> entry/magyar",
  "shared/ui/age.test.ts -> entry/swahili",
  "shared/ui/age.test.ts -> entry/words",
  "shared/ui/age.ts -> entry/words",
  "shared/ui/bellBadge.test.tsx -> inbox/api",
  "shared/ui/bellBadge.test.tsx -> market/start/api",
  "shared/ui/tabBar.test.tsx -> agency/open",
  "shared/ui/tabBar.test.tsx -> inbox/api",
  "shared/ui/tabBar.test.tsx -> market/start/api",
  "shared/ui/tabBar.test.tsx -> routes",
  "shared/ui/tabBar.test.tsx -> tabs",
  "shared/wakala/instance.test.ts -> agency/open",
  "shared/wakala/mcp.test.ts -> agency/open",
  "shared/wakala/mcp.ts -> agency/open",
  "shared/wakala/me.test.ts -> market/supply/api",
];

const deepImportsIntoFeaturesWithPublicIndex: string[] = [
  "assistant/AssistantPage.tsx -> backlogs/api",
  "assistant/ConfirmCard.tsx -> backlogs/api",
  "assistant/ResultsPanel.tsx -> backlogs/IssueCard",
  "assistant/ResultsPanel.tsx -> backlogs/api",
  "assistant/ResultsPanel.tsx -> backlogs/caps/CapTintScope",
  "assistant/ResultsPanel.tsx -> backlogs/paths",
  "assistant/api.ts -> backlogs/api",
  "assistant/cards.test.tsx -> backlogs/api",
  "assistant/confirm.ts -> backlogs/api",
  "assistant/confirm.ts -> backlogs/smart/fields",
  "assistant/confirm.ts -> backlogs/smart/types",
  "assistant/confirmKey.test.tsx -> backlogs/api",
  "assistant/confirmNames.test.tsx -> backlogs/api",
  "assistant/keeps.test.tsx -> backlogs/api",
  "assistant/moveByKey.test.tsx -> backlogs/api",
  "assistant/namedBacklog.ts -> backlogs/api",
  "assistant/openAll.test.tsx -> backlogs/api",
  "assistant/openAll.test.tsx -> backlogs/paths",
  "assistant/openAllTarget.test.ts -> backlogs/paths",
  "assistant/openAllTarget.test.ts -> backlogs/smart/paths",
  "assistant/openOrdinal.test.ts -> backlogs/api",
  "assistant/results.test.tsx -> backlogs/api",
  "assistant/results.ts -> backlogs/api",
  "assistant/results.ts -> backlogs/paths",
  "assistant/results.ts -> backlogs/smart/paths",
  "assistant/resultsBack.test.tsx -> backlogs/api",
  "assistant/ruleCodes.ts -> backlogs/marks",
  "assistant/ruleCodes.ts -> backlogs/smart/fields",
  "assistant/ruleCodes.ts -> backlogs/smart/types",
  "assistant/screenGaps.test.tsx -> backlogs/api",
  "chat/rooms/cards.tsx -> backlogs/cards/BacklogViewCard",
  "chat/rooms/cards.tsx -> backlogs/cards/views",
  "files/api.ts -> backlogs/api",
  "home/HomeOptions.tsx -> backlogs/access",
  "home/HomeOptions.tsx -> backlogs/api",
  "home/homeFiles.test.tsx -> backlogs/api",
  "home/homeOptions.test.tsx -> backlogs/api",
  "home/lastBacklog.ts -> backlogs/api",
  "inbox/AssignedIssueRows.tsx -> backlogs/paths",
  "inbox/assignedIssues.ts -> backlogs/api",
  "inbox/notice.ts -> backlogs/paths",
  "inbox/rowsOpen.test.tsx -> backlogs/paths",
  "inbox/subjectCheck.ts -> backlogs/api",
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

const unlisted = (found: Import[], listed: string[]): string[] =>
  found.filter((one) => !listed.includes(keyOf(one))).map((one) => `${one.file}:${one.line} imports ${one.target}`);

const staleEntries = (found: Import[], listed: string[]): string[] => {
  const present = new Set(found.map(keyOf));
  return listed.filter((entry) => !present.has(entry));
};

describe("the folder strategy of phone-app-structure.md", () => {
  it("has no pages folder", () => {
    expect(existsSync(join(srcRoot, "pages"))).toBe(false);
    expect(existsSync(join(featuresRoot, "pages"))).toBe(false);
  });

  it("keeps shared from importing a feature or the shell, apart from the listed imports", () => {
    expect(unlisted(sharedImportsOfFeaturesAndShellFound, sharedImportsOfFeaturesAndShell)).toEqual([]);
  });

  it("lists no shared import that has since been fixed", () => {
    expect(staleEntries(sharedImportsOfFeaturesAndShellFound, sharedImportsOfFeaturesAndShell)).toEqual([]);
  });

  it("reaches a feature that has a public index only through that index, apart from the listed imports", () => {
    expect(unlisted(deepImportsIntoFeaturesWithPublicIndexFound, deepImportsIntoFeaturesWithPublicIndex)).toEqual([]);
  });

  it("lists no deep import that has since been fixed", () => {
    expect(staleEntries(deepImportsIntoFeaturesWithPublicIndexFound, deepImportsIntoFeaturesWithPublicIndex)).toEqual([]);
  });

  it("guards the features that have a public index today", () => {
    expect(featuresWithPublicIndex.length).toBeGreaterThan(0);
  });
});
