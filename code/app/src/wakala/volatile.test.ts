import { forgetRuntimeConfig, setRuntimeConfig } from "./config";
import { callTool, resetMcp } from "./mcp";

const toolCalls = (fetcher: ReturnType<typeof vi.fn>, tool: string) =>
  fetcher.mock.calls.filter(([, init]) => String(init?.body ?? "").includes(`"name":"${tool}"`)).length;

const stubWakala = () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = String(init?.body ?? "");
    const text = body.includes('"initialize"')
      ? '{"jsonrpc":"2.0","id":1,"result":{}}'
      : '{"jsonrpc":"2.0","id":2,"result":{"structuredContent":{"items":[]}}}';
    return { ok: true, status: 200, headers: new Headers({ "Mcp-Session-Id": "s1" }), text: async () => text };
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

describe("reads that change under another person's hand", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setRuntimeConfig({ mcp: "https://api.example/mcp" });
    resetMcp();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    forgetRuntimeConfig();
    resetMcp();
  });

  it.each(["market_list_asks", "market_list_yeses", "market_list_orders", "market_list_notices"])(
    "asks again for %s once 10 seconds have passed",
    async (tool) => {
      const fetcher = stubWakala();
      await callTool("", tool, {});
      await vi.advanceTimersByTimeAsync(11_000);
      await callTool("", tool, {});
      expect(toolCalls(fetcher, tool)).toBe(2);
    },
  );

  it("still holds an ordinary list for a minute", async () => {
    const fetcher = stubWakala();
    await callTool("", "market_list_offers", {});
    await vi.advanceTimersByTimeAsync(11_000);
    await callTool("", "market_list_offers", {});
    expect(toolCalls(fetcher, "market_list_offers")).toBe(1);
  });

  it.each(["market_get_order", "market_get_group_order", "market_get_ask", "market_get_yes", "market_get_notice"])(
    "asks again for the single record %s once 10 seconds have passed",
    async (tool) => {
      const fetcher = stubWakala();
      await callTool("", tool, { id: "x" });
      await vi.advanceTimersByTimeAsync(11_000);
      await callTool("", tool, { id: "x" });
      expect(toolCalls(fetcher, tool)).toBe(2);
    },
  );

  it.each(["market_get_stock", "market_list_posters", "market_list_offers"])(
    "still holds catalogue-like %s for a minute",
    async (tool) => {
      const fetcher = stubWakala();
      await callTool("", tool, {});
      await vi.advanceTimersByTimeAsync(11_000);
      await callTool("", tool, {});
      expect(toolCalls(fetcher, tool)).toBe(1);
    },
  );

  it("treats market_order_trail as a read that is reused and does not clear the cache", async () => {
    const fetcher = stubWakala();
    await callTool("", "market_list_offers", {});
    await callTool("", "market_order_trail", { orderID: "o1" });
    await callTool("", "market_list_offers", {});
    expect(toolCalls(fetcher, "market_list_offers")).toBe(1);
    await callTool("", "market_order_trail", { orderID: "o1" });
    expect(toolCalls(fetcher, "market_order_trail")).toBe(1);
  });

  it("asks for the trail again after 10 seconds", async () => {
    const fetcher = stubWakala();
    await callTool("", "market_order_trail", { orderID: "o1" });
    await vi.advanceTimersByTimeAsync(11_000);
    await callTool("", "market_order_trail", { orderID: "o1" });
    expect(toolCalls(fetcher, "market_order_trail")).toBe(2);
  });
});
