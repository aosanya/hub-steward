import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { profilePage } from "./profile";

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

const save = (values: Record<string, unknown>) => profilePage.actions!.profile("h1", values);

const rename = (values: Record<string, unknown>) => profilePage.actions!.hubname("h1", values);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the profile page", () => {
  it("offers Save changes and lists the tool that reads the agency and the one that updates it", () => {
    expect(profilePage.spec.id).toBe("profile");
    expect(profilePage.spec.title).toBe("Profile");
    expect(profilePage.spec.primary).toBe("Save changes");
    expect(profilePage.spec.tools).toEqual(["agency_get_agency", "agency_update_agency"]);
    expect(profilePage.spec.columns).toEqual([
      { key: "name", label: "Name" },
      { key: "purpose", label: "Purpose" },
      { key: "id", label: "Id" },
    ]);
  });

  it("shows the name, purpose and id of the agency and writes nothing", async () => {
    answerWith({ agency_get_agency: { id: "ag-1", name: "Test Hub", description: "Help neighbours", extra: "x" } });

    const rows = await profilePage.rows("h1", {});

    expect(rows).toEqual([{ name: "Test Hub", purpose: "Help neighbours", id: "ag-1" }]);
    expect(toolsCalled()).toEqual(["agency_get_agency"]);
  });

  it("reads the agency with no draft id and without asking for the drafts, because the agency tool takes none", async () => {
    answerWith({ agency_get_agency: { id: "ag-1", name: "Test Hub" }, agency_list_drafts: { items: [{ id: "d1", status: "open" }] } });

    await profilePage.rows("h1", {});

    expect(vi.mocked(callTool).mock.calls).toEqual([["h1", "agency_get_agency"]]);
  });

  it("reads the agency when the answer wraps it in an envelope", async () => {
    answerWith({ agency_get_agency: { agency: { id: "ag-2", name: "Wrapped", description: "P" } } });

    expect(await profilePage.rows("h1", {})).toEqual([{ name: "Wrapped", purpose: "P", id: "ag-2" }]);
  });

  it("shows empty cells for what the agency does not have", async () => {
    answerWith({ agency_get_agency: {} });

    expect(await profilePage.rows("h1", {})).toEqual([{ name: "", purpose: "", id: "" }]);
  });

  it("fails the page when the tool fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));

    await expect(profilePage.rows("h1", {})).rejects.toThrow("boom");
  });

  it("fails the page when the answer is not an agency", async () => {
    answerWith({ agency_get_agency: [1] });

    await expect(profilePage.rows("h1", {})).rejects.toThrow("agency_get_agency");
  });
});

describe("saving the profile", () => {
  it("updates the agency's name and purpose directly, trimmed, with no proposal", async () => {
    answerWith({ agency_update_agency: { id: "ag-1" } });

    const result = await save({ name: "  Test Hub  ", description: " Help neighbours " });

    expect(result).toBe("done");
    expect(toolsCalled()).toEqual(["agency_update_agency"]);
    expect(vi.mocked(callTool).mock.calls[0]).toEqual(["h1", "agency_update_agency", { name: "Test Hub", description: "Help neighbours" }]);
  });

  it("refuses an empty name without calling anything", async () => {
    await expect(save({ name: "   ", description: "x" })).rejects.toThrow("name is required");
    await expect(save({})).rejects.toThrow("name is required");

    expect(callTool).not.toHaveBeenCalled();
  });

  it("fails when the update fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));

    await expect(save({ name: "A" })).rejects.toThrow("boom");
  });
});

describe("renaming the hub", () => {
  it("asks for approval to rename the hub with a request of its own kind", async () => {
    answerWith({ agency_propose_write: { status: "pending" } });

    const result = await rename({ name: "  Test Hub  " });

    expect(result).toBe("accepted");
    expect(toolsCalled()).toEqual(["agency_propose_write"]);
    expect(proposal()).toEqual({ kind: "instance_rename", summary: "Rename this hub to Test Hub", payload: { name: "Test Hub" } });
  });

  it("refuses a blank name without calling anything", async () => {
    await expect(rename({ name: "   " })).rejects.toThrow("name is required");

    expect(callTool).not.toHaveBeenCalled();
  });

  it("accepts a name of exactly 120 characters and refuses one of 121", async () => {
    answerWith({ agency_propose_write: {} });

    await rename({ name: "é".repeat(120) });
    expect(callTool).toHaveBeenCalledTimes(1);

    await expect(rename({ name: "é".repeat(121) })).rejects.toThrow("name is longer than 120 characters");
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it("counts a character outside the basic plane as one character", async () => {
    answerWith({ agency_propose_write: {} });

    await rename({ name: "😀".repeat(120) });

    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it("fails when the approval request fails", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("boom"));

    await expect(rename({ name: "A" })).rejects.toThrow("boom");
  });
});
