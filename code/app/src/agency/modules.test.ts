import * as mcp from "../wakala/mcp";
import { agencyTools, mcpAgencyClient, modulesOf } from "./modules";

afterEach(() => vi.restoreAllMocks());

const answer = (replies: Record<string, unknown>) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => {
    const reply = replies[tool];
    if (reply instanceof Error) throw reply;
    return reply as never;
  });

describe("agency modules client", () => {
  it("keeps each module the agency has mounted and gives it the name of its first mount", () => {
    const reply = {
      modules: [
        { module: "market", mounts: [{ name: "Inputs market", key: "inputs" }, { name: "Produce market", key: "produce" }] },
        { module: "auth", mounts: [{ name: "", key: "main" }] },
        { module: "git" },
        { module: "", mounts: [{ name: "stray", key: "x" }] },
      ],
    };
    expect(modulesOf(reply)).toEqual([
      { code: "market", name: "Inputs market" },
      { code: "auth", name: "auth" },
      { code: "git", name: "git" },
    ]);
  });

  it("reads the agency name and its mounted modules through agency_get_agency and agency_list_mounts", async () => {
    const call = answer({
      [agencyTools.agency]: { name: "Siaya Farmers' Group" },
      [agencyTools.modules]: { modules: [{ module: "market", mounts: [{ name: "Market", key: "market" }] }] },
    });
    expect(await mcpAgencyClient.read()).toEqual({
      name: "Siaya Farmers' Group",
      modules: [{ code: "market", name: "Market" }],
    });
    expect(call).toHaveBeenCalledWith("", "agency_get_agency", {});
    expect(call).toHaveBeenCalledWith("", "agency_list_mounts", {});
    expect(call).not.toHaveBeenCalledWith("", "agency_list_modules", expect.anything());
  });

  it("still answers when only one of the two reads works", async () => {
    answer({ [agencyTools.agency]: new Error("down"), [agencyTools.modules]: { modules: [{ module: "market", mounts: [{ name: "m", key: "market" }] }] } });
    expect((await mcpAgencyClient.read()).name).toBe("");
    answer({ [agencyTools.agency]: { name: "Siaya" }, [agencyTools.modules]: new Error("down") });
    expect(await mcpAgencyClient.read()).toEqual({ name: "Siaya", modules: [], modulesUnread: true });
  });

  it("reports an empty list, not an unknown one, when no module is mounted", async () => {
    answer({ [agencyTools.agency]: { name: "Siaya" }, [agencyTools.modules]: { modules: [] } });
    expect(await mcpAgencyClient.read()).toEqual({ name: "Siaya", modules: [] });
  });

  it("reports the modules as unknown when the reply carries no list", async () => {
    answer({ [agencyTools.agency]: { name: "Siaya" }, [agencyTools.modules]: {} });
    expect(await mcpAgencyClient.read()).toEqual({ name: "Siaya", modules: [], modulesUnread: true });
  });

  it("fails when neither read works", async () => {
    answer({ [agencyTools.agency]: new Error("down"), [agencyTools.modules]: new Error("down") });
    await expect(mcpAgencyClient.read()).rejects.toThrow("down");
  });
});
