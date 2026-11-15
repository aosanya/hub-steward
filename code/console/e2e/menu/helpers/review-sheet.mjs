import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const menuDir = resolve(here, "../../../../../documentation/4. qa/testing/03-screenshots/menu");
const skipped = new Set(["00-smoke"]);

const sectionFolders = readdirSync(menuDir)
  .filter((name) => statSync(resolve(menuDir, name)).isDirectory() && !skipped.has(name))
  .sort();

const picturesIn = (folder) =>
  readdirSync(resolve(menuDir, folder)).filter((name) => name.endsWith(".png")).sort();

const titleOf = (folder) => folder.replace(/^\d+-/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

const sections = sectionFolders.map((folder) => ({ folder, pictures: picturesIn(folder) }));
const pictureCount = sections.reduce((total, section) => total + section.pictures.length, 0);

const lines = [
  "# Menu drawings, review sheet",
  "",
  `${sections.length} journeys, ${pictureCount} pictures.`,
  "",
  ...sections.flatMap(({ folder, pictures }) => [
    `## ${titleOf(folder)}`,
    "",
    ...pictures.flatMap((name) => [`![${name}](${encodeURI(folder)}/${encodeURI(name)})`, "", `\`${name}\``, ""]),
  ]),
];

writeFileSync(resolve(menuDir, "README.md"), lines.join("\n"));
process.stdout.write(`${sections.length} journeys, ${pictureCount} pictures\n`);
