import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const sourcesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });

const here = join(process.cwd(), "src");

describe("the sell and apps sources", () => {
  it("name no product of their own", () => {
    const typed = [...sourcesUnder(join(here, "sell")), ...sourcesUnder(join(here, "apps"))].filter((path) =>
      /maize/i.test(readFileSync(path, "utf8")),
    );
    expect(typed).toEqual([]);
  });

  it("capitalise no product key into a name", () => {
    const capitalised = [...sourcesUnder(join(here, "sell")), ...sourcesUnder(join(here, "apps"))].filter((path) =>
      /productTitle/.test(readFileSync(path, "utf8")),
    );
    expect(capitalised).toEqual([]);
  });
});
