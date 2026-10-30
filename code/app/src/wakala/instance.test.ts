import { forgetOpenAgency, openAgency } from "../agency/open";
import { forgetRuntimeConfig, setRuntimeConfig } from "./config";
import { callTool, resetMcp } from "./mcp";

const sentArguments = (fetcher: ReturnType<typeof vi.fn>, tool: string) =>
  fetcher.mock.calls
    .map(([, init]) => JSON.parse(String(init?.body ?? "{}")))
    .filter((body) => body.method === "tools/call" && body.params.name === tool)
    .map((body) => body.params.arguments);

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

beforeEach(() => {
  setRuntimeConfig({ mcp: "https://api.example/mcp" });
  resetMcp();
  forgetOpenAgency();
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetRuntimeConfig();
  resetMcp();
  forgetOpenAgency();
});

describe("a tool call names the open agency", () => {
  it("sends the open agency as the instance_id of a read", async () => {
    const fetcher = stubWakala();
    openAgency("farmers-id");
    await callTool("", "market_list_asks", {});
    expect(sentArguments(fetcher, "market_list_asks")).toEqual([{ instance_id: "farmers-id" }]);
  });

  it("sends it with the other arguments of a write", async () => {
    const fetcher = stubWakala();
    openAgency("farmers-id");
    await callTool("", "forms_answer_submit", { form_id: "f1" });
    expect(sentArguments(fetcher, "forms_answer_submit")).toEqual([{ form_id: "f1", instance_id: "farmers-id" }]);
  });

  it("follows the agency opened last", async () => {
    const fetcher = stubWakala();
    openAgency("farmers-id");
    await callTool("", "actor_list_my_groups", {});
    openAgency("riders-id");
    await callTool("", "actor_list_my_groups", {});
    expect(sentArguments(fetcher, "actor_list_my_groups")).toEqual([{ instance_id: "farmers-id" }, { instance_id: "riders-id" }]);
  });

  it("does not scope the list of the member's agencies", async () => {
    const fetcher = stubWakala();
    openAgency("farmers-id");
    await callTool("", "agency_list_instances");
    expect(sentArguments(fetcher, "agency_list_instances")).toEqual([{}]);
  });

  it("sends no instance_id while no agency is open", async () => {
    const fetcher = stubWakala();
    await callTool("", "market_list_asks", {});
    expect(sentArguments(fetcher, "market_list_asks")).toEqual([{}]);
  });

  it("keeps an instance the caller named", async () => {
    const fetcher = stubWakala();
    openAgency("farmers-id");
    await callTool("riders-id", "market_list_posters", {});
    expect(sentArguments(fetcher, "market_list_posters")).toEqual([{ instance_id: "riders-id" }]);
  });
});
