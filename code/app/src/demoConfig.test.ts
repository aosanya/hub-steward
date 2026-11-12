import type { ViteDevServer } from "vite";
import { demoConfig, demoConfigJson } from "../demoConfig";

const sources = import.meta.glob(["./**/*.ts", "./**/*.tsx", "./**/*.css", "!./**/*.test.*", "!./**/*.test-support.*", "!./test-setup.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("the demo build config", () => {
  it("takes the wakala address from the build variable and trims it", () => {
    expect(JSON.parse(demoConfigJson(" https://x.test/// "))).toEqual({ wakala: "https://x.test" });
  });

  it("is same-origin when the variable is unset", () => {
    expect(JSON.parse(demoConfigJson(undefined))).toEqual({ wakala: "" });
  });

  it("names the one agency the app is limited to", () => {
    expect(JSON.parse(demoConfigJson("", " Zöldhalom "))).toEqual({ wakala: "", agency: "Zöldhalom" });
  });

  const served = (wakala: string | undefined, agency?: string) => {
    const mounted: { path: string; handler: (request: unknown, response: { setHeader: (name: string, value: string) => void; end: (body: string) => void }) => void }[] = [];
    const server = { middlewares: { use: (path: string, handler: never) => mounted.push({ path, handler }) } } as unknown as ViteDevServer;
    (demoConfig(wakala, agency).configureServer as (server: ViteDevServer) => void)(server);
    return mounted;
  };

  it("serves config.json from the dev server when the variable is set, so hot reload reaches the same API", () => {
    const [route] = served("http://localhost:8092/");
    let body = "";
    route.handler({}, { setHeader: () => undefined, end: (text) => (body = text) });
    expect(route.path).toBe("/config.json");
    expect(JSON.parse(body)).toEqual({ wakala: "http://localhost:8092" });
  });

  it("serves config.json from the dev server for a limited agency even through a same-origin proxy", () => {
    const [route] = served(undefined, "Zöldhalom");
    let body = "";
    route.handler({}, { setHeader: () => undefined, end: (text) => (body = text) });
    expect(JSON.parse(body)).toEqual({ wakala: "", agency: "Zöldhalom" });
  });

  it("serves nothing from the dev server when the variable is unset", () => {
    expect(served(undefined)).toEqual([]);
  });

  it("carries no hardcoded address in the app sources", () => {
    const classifiesHosts = "./entry/localHub.ts";
    const offenders = Object.keys(sources)
      .filter((file) => file !== classifiesHosts)
      .filter((file) => /https?:\/\/|localhost|127\.0\.0\.1/.test(sources[file]));
    expect(offenders).toEqual([]);
  });
});
