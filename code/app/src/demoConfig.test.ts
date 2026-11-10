import { demoConfigJson } from "../demoConfig";

const sources = import.meta.glob(["./**/*.ts", "./**/*.tsx", "./**/*.css", "!./**/*.test.*", "!./**/*.test-support.*", "!./test-setup.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("the demo build config", () => {
  it("takes the wakala address from the build variable and trims it", () => {
    expect(JSON.parse(demoConfigJson(" https://x.test/// "))).toEqual({ wakala: "https://x.test" });
  });

  it("is same-origin when the variable is unset", () => {
    expect(JSON.parse(demoConfigJson(undefined))).toEqual({ wakala: "" });
  });

  it("carries no hardcoded address in the app sources", () => {
    const classifiesHosts = "./entry/localHub.ts";
    const offenders = Object.keys(sources)
      .filter((file) => file !== classifiesHosts)
      .filter((file) => /https?:\/\/|localhost|127\.0\.0\.1/.test(sources[file]));
    expect(offenders).toEqual([]);
  });
});
