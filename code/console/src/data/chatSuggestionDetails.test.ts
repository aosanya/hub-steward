import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import { loadDetails } from "./chatSuggestionDetails";

vi.mock("../wakala/mcp");

const suggestion = { title: "Tidy R-1", detail: "", tool: "agency_update_role", arguments: {}, then: [] };

const callsTo = (tool: string) => vi.mocked(callTool).mock.calls.filter(([, name]) => name === tool).map(([, , args]) => args ?? {});

const answering = (replies: Record<string, unknown>) =>
  vi.mocked(callTool).mockImplementation((async (_hubId: string, tool: string) => replies[tool] ?? { items: [] }) as never);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("naming the permissions of a role in a suggestion", () => {
  it("reads the permission names with no arguments while a draft is open", async () => {
    answering({
      agency_list_drafts: { items: [{ id: "d1", status: "open", description: "" }] },
      agency_list_roles: { items: [{ id: "r1", code: "R-1", name: "Farmer", permissions: ["market.sell"] }] },
      agency_list_permissions: { items: [{ code: "market.sell", name: "Sell on the market" }] },
    });

    const cards = await loadDetails("h", suggestion);

    expect(callsTo("agency_list_permissions")).toEqual([{}]);
    expect(callsTo("agency_list_roles")).toEqual([{ draft_id: "d1" }]);
    expect(cards[0].permissions).toEqual(["Sell on the market"]);
  });
});
