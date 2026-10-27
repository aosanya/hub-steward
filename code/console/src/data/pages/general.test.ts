import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { generalPage } from "./general";

vi.mock("../../wakala/mcp");

const answerWith = (replies: Record<string, unknown>) =>
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
    if (!Object.hasOwn(replies, tool)) throw new Error("unexpected tool " + tool);
    return replies[tool] as never;
  });

const toolsCalled = () => vi.mocked(callTool).mock.calls.map((call) => call[1]);

const proposal = () => {
  const args = vi.mocked(callTool).mock.calls.find((call) => call[1] === "agency_propose_write")?.[2] as {
    kind: string;
    summary: string;
    payload: string;
  };
  return { kind: args.kind, summary: args.summary, payload: JSON.parse(args.payload) };
};

const changeJoining = (values: Record<string, unknown>) => generalPage.actions!.general("h1", values);

const changeLanguage = (values: Record<string, unknown>) => generalPage.actions!.language("h1", values);

const stored = { instance_id: "h", studio_default: "en", content: ["en", "hu"], content_default: "en" };

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the general page", () => {
  it("offers Save changes and lists the two tools that read the settings", () => {
    expect(generalPage.spec.id).toBe("general");
    expect(generalPage.spec.title).toBe("General");
    expect(generalPage.spec.primary).toBe("Save changes");
    expect(generalPage.spec.tools).toEqual(["instance_get_join_mode", "instance_get_languages"]);
    expect(generalPage.spec.columns).toEqual([
      { key: "joining", label: "Joining" },
      { key: "default_language", label: "Default language" },
      { key: "theme", label: "Theme" },
    ]);
  });

  it("shows how joining works, the default language, the languages and the themes without writing", async () => {
    answerWith({
      instance_get_join_mode: { join_mode: "confirmed" },
      instance_get_languages: { languages: [{ code: "en", default: false }, { code: "sw", default: true }] },
    });

    const [row] = await generalPage.rows("h1", {});

    expect(row).toMatchObject({
      joining: "confirmed",
      joining_label: "Approval required",
      default_language: "sw",
      languages: ["en", "sw"],
      theme: "dark",
    });
    expect(row.themes).toEqual([
      { id: "dark", label: "Dark", default: true },
      { id: "light", label: "Light", default: false },
      { id: "midnight", label: "Midnight", default: false },
      { id: "forest", label: "Forest", default: false },
      { id: "contrast", label: "High contrast", default: false },
    ]);
    expect(toolsCalled()).toEqual(["instance_get_join_mode", "instance_get_languages"]);
  });

  it("labels an open hub as open to join and reads the default language from the answer itself", async () => {
    answerWith({ instance_get_join_mode: "open", instance_get_languages: { default: "en" } });

    const [row] = await generalPage.rows("h1", {});

    expect(row).toMatchObject({ joining: "open", joining_label: "Open to join", default_language: "en", languages: [] });
  });

  it("reads the joining mode from a mode field when there is no join_mode field", async () => {
    answerWith({ instance_get_join_mode: { mode: "open" }, instance_get_languages: {} });

    const [row] = await generalPage.rows("h1", {});

    expect(row).toMatchObject({ joining: "open", joining_label: "Open to join", default_language: "", languages: [] });
  });

  it("leaves the label empty for a joining mode it does not know", async () => {
    answerWith({ instance_get_join_mode: "constructor", instance_get_languages: {} });

    const [row] = await generalPage.rows("h1", {});

    expect(row).toMatchObject({ joining: "constructor", joining_label: "" });
  });

  it("says that a joining change is a pending write", async () => {
    answerWith({ instance_get_join_mode: "open", instance_get_languages: { default: "en" } });

    const [row] = await generalPage.rows("h1", {});

    expect(row.pending_writes).toEqual(["joining"]);
  });

  it("fails the page when a tool fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));

    await expect(generalPage.rows("h1", {})).rejects.toThrow("boom");
  });
});

describe("changing how joining works", () => {
  it.each([
    ["confirmed", "Make joining approval-only"],
    ["open", "Make joining open to everyone"],
  ])("asks for approval to make joining %s and never sets it directly", async (mode, summary) => {
    answerWith({ agency_propose_write: { status: "pending" } });

    const result = await changeJoining({ join_mode: mode });

    expect(result).toBe("accepted");
    expect(toolsCalled()).toEqual(["agency_propose_write"]);
    expect(proposal()).toEqual({ kind: "instance_set_join_mode", summary, payload: { join_mode: mode } });
  });

  it.each(["", "wide", "OPEN", " open"])("refuses the joining value %j without calling anything", async (mode) => {
    await expect(changeJoining({ join_mode: mode })).rejects.toThrow("joining must be open or confirmed");

    expect(callTool).not.toHaveBeenCalled();
  });

  it("refuses a request with no joining value", async () => {
    await expect(changeJoining({})).rejects.toThrow("joining must be open or confirmed");
  });

  it("fails when the approval request fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));

    await expect(changeJoining({ join_mode: "open" })).rejects.toThrow("boom");
  });
});

describe("setting the default language", () => {
  it("keeps the other languages and asks for approval only", async () => {
    answerWith({ instance_get_languages: stored, agency_propose_write: { id: "ap-1" } });

    const result = await changeLanguage({ language: "hu" });

    expect(result).toBe("accepted");
    expect(toolsCalled()).toEqual(["instance_get_languages", "agency_propose_write"]);
    expect(proposal()).toEqual({
      kind: "instance_set_languages",
      summary: "Make hu the default language",
      payload: { studio_default: "en", content: ["en", "hu"], content_default: "hu" },
    });
  });

  it("adds a language the hub does not have yet to the list", async () => {
    answerWith({ instance_get_languages: stored, agency_propose_write: {} });

    await changeLanguage({ language: "de" });

    expect(proposal().payload).toEqual({ studio_default: "en", content: ["en", "hu", "de"], content_default: "de" });
  });

  it("trims the language code before using it", async () => {
    answerWith({ instance_get_languages: stored, agency_propose_write: {} });

    await changeLanguage({ language: "  hu " });

    expect(proposal().summary).toBe("Make hu the default language");
    expect(proposal().payload.content_default).toBe("hu");
  });

  it("starts the list from the chosen language when the hub has none stored", async () => {
    answerWith({ instance_get_languages: {}, agency_propose_write: {} });

    await changeLanguage({ language: "sw" });

    expect(proposal().payload).toEqual({ studio_default: "", content: ["sw"], content_default: "sw" });
  });

  it("refuses an empty language code without calling anything", async () => {
    await expect(changeLanguage({ language: " " })).rejects.toThrow("choose a language code");
    await expect(changeLanguage({})).rejects.toThrow("choose a language code");

    expect(callTool).not.toHaveBeenCalled();
  });

  it("fails without asking for approval when the stored languages cannot be read", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));

    await expect(changeLanguage({ language: "hu" })).rejects.toThrow("boom");
    expect(toolsCalled()).toEqual(["instance_get_languages"]);
  });

  it("fails without asking for approval when the stored languages are not settings", async () => {
    answerWith({ instance_get_languages: ["en"] });

    await expect(changeLanguage({ language: "hu" })).rejects.toThrow("instance_get_languages");
    expect(toolsCalled()).toEqual(["instance_get_languages"]);
  });

  it("fails when the approval request fails", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "agency_propose_write") throw new Error("boom");
      return stored as never;
    });

    await expect(changeLanguage({ language: "hu" })).rejects.toThrow("boom");
  });
});
