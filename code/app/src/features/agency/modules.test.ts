import * as mcp from "../../shared/wakala/mcp";
import { agencyTools, mcpAgencyClient, modulesOf, word, type AgencyView } from "./modules";

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
      { code: "market", name: "Inputs market", mountNames: ["Inputs market", "Produce market"] },
      { code: "auth", name: "auth", mountNames: [""] },
      { code: "git", name: "git", mountNames: [] },
    ]);
  });

  it("reads the agency name and its mounted modules through agency_get_agency and agency_list_mounts", async () => {
    const call = answer({
      [agencyTools.agency]: { name: "Siaya Farmers' Group" },
      [agencyTools.modules]: { modules: [{ module: "market", mounts: [{ name: "Market", key: "market" }] }] },
    });
    expect(await mcpAgencyClient.read()).toEqual({
      name: "Siaya Farmers' Group",
      modules: [{ code: "market", name: "Market", mountNames: ["Market"] }],
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

describe("agency words", () => {
  const view = (modules: unknown[]): AgencyView => ({ name: "Town", modules: modulesOf({ modules }) });
  const municipality = view([{ module: "actor", mounts: [{ name: "Residents", key: "directory", words: { People: "Residents", Person: "Resident" } }] }]);

  it("reads the words a mount lists into its module", () => {
    expect(modulesOf({ modules: [{ module: "actor", mounts: [{ name: "Residents", key: "directory", words: { People: "Residents" } }] }] })).toEqual([
      { code: "actor", name: "Residents", mountNames: ["Residents"], words: { People: "Residents" } },
    ]);
  });

  it("answers the agency's word where its mount lists the generic one", () => {
    expect(word(municipality, "People")).toBe("Residents");
    expect(word(municipality, "Person")).toBe("Resident");
  });

  it("answers the generic word for an agency with no words", () => {
    expect(word(view([{ module: "actor", mounts: [{ name: "People", key: "directory" }] }]), "People")).toBe("People");
  });

  it("returns an unknown generic word unchanged", () => {
    expect(word(municipality, "Market")).toBe("Market");
  });

  it("returns the generic word when the modules were not read or there is no agency", () => {
    expect(word({ name: "", modules: [], modulesUnread: true }, "People")).toBe("People");
    expect(word(null, "People")).toBe("People");
    expect(word(undefined, "People")).toBe("People");
  });

  it("takes the mount of the section being drawn when two mounts list the same generic word", () => {
    const two = view([
      { module: "market", mounts: [{ name: "Market", key: "m", words: { Items: "Goods" } }] },
      { module: "assetmanager", mounts: [{ name: "Assets", key: "a", words: { Items: "Equipment" } }] },
    ]);
    expect(word(two, "Items", "assetmanager")).toBe("Equipment");
    expect(word(two, "Items", "market")).toBe("Goods");
    expect(word(two, "Items")).toBe("Goods");
    expect(word(two, "Items", "git")).toBe("Goods");
  });

  it("ignores empty words and words that are not text lists", () => {
    const odd = view([{ module: "actor", mounts: [{ name: "A", key: "k", words: { People: "", Person: "Resident" } }, { name: "B", key: "j", words: ["x"] }] }]);
    expect(word(odd, "People")).toBe("People");
    expect(word(odd, "Person")).toBe("Resident");
  });

  it("does not answer for names every object has", () => {
    expect(word(municipality, "constructor")).toBe("constructor");
  });
});
