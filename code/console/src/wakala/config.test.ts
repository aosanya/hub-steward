import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetRuntimeConfig, parseConfig, runtimeConfig, setRuntimeConfig } from "./config";

const answer = (status: number, body: unknown) => vi.fn(async () => ({ ok: status < 400, status, json: async () => body }));

beforeEach(() => {
  forgetRuntimeConfig();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reading the runtime config", () => {
  it("takes the wakala address and the mcp address from config.json", async () => {
    vi.stubGlobal("fetch", answer(200, { wakala: "https://api.hub.example", mcp: "https://api.hub.example/mcp" }));

    expect(await runtimeConfig()).toEqual({ wakala: "https://api.hub.example", mcp: "https://api.hub.example/mcp", template: "" });
  });

  it("asks the bundle for /config.json without using a cached copy", async () => {
    const fetchStub = answer(200, { wakala: "https://api.hub.example" });
    vi.stubGlobal("fetch", fetchStub);

    await runtimeConfig();

    expect(fetchStub).toHaveBeenCalledWith("/config.json", { cache: "no-store" });
  });

  it("asks only once for as many callers as there are", async () => {
    const fetchStub = answer(200, { wakala: "https://api.hub.example" });
    vi.stubGlobal("fetch", fetchStub);

    await Promise.all([runtimeConfig(), runtimeConfig(), runtimeConfig()]);
    await runtimeConfig();

    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("puts the mcp address under the wakala address when config.json names only wakala", () => {
    expect(parseConfig({ wakala: "https://api.hub.example" }).mcp).toBe("https://api.hub.example/mcp");
  });

  it("drops a trailing slash from both addresses", () => {
    expect(parseConfig({ wakala: "https://api.hub.example/", mcp: "https://api.hub.example/mcp/" })).toMatchObject({
      wakala: "https://api.hub.example",
      mcp: "https://api.hub.example/mcp",
    });
  });

  it("lets config.json point the mcp address at the same-origin pass-through", () => {
    expect(parseConfig({ wakala: "https://api.hub.example", mcp: "/mcp" })).toMatchObject({ wakala: "https://api.hub.example", mcp: "/mcp" });
  });

  it("names the template config.json chooses", () => {
    expect(parseConfig({ wakala: "x", template: "farmers" }).template).toBe("farmers");
  });

  it("names no template when config.json names none", () => {
    expect(parseConfig({ wakala: "x" }).template).toBe("");
  });

  it("falls back to the same origin when config.json holds nothing usable", () => {
    expect(parseConfig(null)).toEqual({ wakala: "", mcp: "/mcp", template: "" });
    expect(parseConfig("text")).toEqual({ wakala: "", mcp: "/mcp", template: "" });
    expect(parseConfig({ wakala: 5, mcp: [] })).toEqual({ wakala: "", mcp: "/mcp", template: "" });
  });

  it("falls back to the same origin when config.json is missing", async () => {
    vi.stubGlobal("fetch", answer(404, {}));

    expect(await runtimeConfig()).toEqual({ wakala: "", mcp: "/mcp", template: "" });
  });

  it("falls back to the same origin when config.json cannot be fetched, and asks again next time", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("network down");
    });
    vi.stubGlobal("fetch", down);
    expect(await runtimeConfig()).toEqual({ wakala: "", mcp: "/mcp", template: "" });

    vi.stubGlobal("fetch", answer(200, { wakala: "https://api.hub.example" }));

    expect((await runtimeConfig()).wakala).toBe("https://api.hub.example");
    expect(down).toHaveBeenCalledTimes(1);
  });

  it("falls back to the same origin when config.json is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("not json");
        },
      })),
    );

    expect((await runtimeConfig()).wakala).toBe("");
  });

  it("uses a config set in code without asking the bundle", async () => {
    const fetchStub = answer(200, {});
    vi.stubGlobal("fetch", fetchStub);
    setRuntimeConfig({ wakala: "https://set.example", mcp: "https://set.example/mcp" });

    expect((await runtimeConfig()).wakala).toBe("https://set.example");
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
