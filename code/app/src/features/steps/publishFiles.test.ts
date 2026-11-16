import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../shared/wakala/mcp";
import * as api from "./publishApi";

afterEach(() => vi.restoreAllMocks());

const item = { name: "arrivals-final.pdf", path: "reports/arrivals-final.pdf", version: "abc1234def5678", committed_at: "2026-11-13T09:30:00Z" };

describe("reportFileOf", () => {
  it("maps one server item to a report file", () => {
    expect(api.reportFileOf(item)).toEqual({
      name: "arrivals-final.pdf",
      path: "reports/arrivals-final.pdf",
      version: "abc1234def5678",
      committedAt: "2026-11-13T09:30:00Z",
    });
  });

  it("turns missing fields into empty strings", () => {
    expect(api.reportFileOf({ path: "reports/a.pdf" })).toEqual({ name: "", path: "reports/a.pdf", version: "", committedAt: "" });
    expect(api.reportFileOf({})).toEqual({ name: "", path: "", version: "", committedAt: "" });
    expect(api.reportFileOf(undefined)).toEqual({ name: "", path: "", version: "", committedAt: "" });
  });
});

describe("mcpPublishClient.files", () => {
  it("calls forms_results_files with the form id", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] });
    await api.mcpPublishClient.files("f1");
    expect(call).toHaveBeenCalledWith("", "forms_results_files", { form_id: "f1" });
  });

  it("maps the items in the order the server returns them", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({
      items: [item, { name: "arrivals-draft.pdf", path: "reports/arrivals-draft.pdf", version: "9876543fedcba", committed_at: "2026-11-12T08:00:00Z" }],
    });
    expect(await api.mcpPublishClient.files("f1")).toEqual([
      { name: "arrivals-final.pdf", path: "reports/arrivals-final.pdf", version: "abc1234def5678", committedAt: "2026-11-13T09:30:00Z" },
      { name: "arrivals-draft.pdf", path: "reports/arrivals-draft.pdf", version: "9876543fedcba", committedAt: "2026-11-12T08:00:00Z" },
    ]);
  });

  it("returns an empty list when the server has no items", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [] });
    expect(await api.mcpPublishClient.files("f1")).toEqual([]);
    vi.spyOn(mcp, "callTool").mockResolvedValue({});
    expect(await api.mcpPublishClient.files("f1")).toEqual([]);
  });
});
