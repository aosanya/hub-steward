import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../shared/wakala/mcp";
import { closedFormIdOf, holdsReportPublish, mcpPublishClient } from "./publishApi";

afterEach(() => vi.restoreAllMocks());

const forms = [
  { id: "f-open", title: "Arrival", status: "open" },
  { id: "f-other", title: "Departure", status: "closed" },
  { id: "f-closed", title: "  arrival ", status: "closed" },
];

const formListReply = {
  rows: forms.map((form) => ({ form })),
  total: 3,
  by_status: { open: 1, closed: 2 },
  respondents: 0,
};

describe("holdsReportPublish", () => {
  it("is true for the owner whose reply lists every code", () => {
    expect(holdsReportPublish({ roles: [], permissions: ["poll.run", "report.publish", "form.close"] })).toBe(true);
  });

  it("is true for the director whose reply lists only report.publish", () => {
    expect(holdsReportPublish({ permissions: ["report.publish"] })).toBe(true);
  });

  it("is false for the clerk who holds poll.run only", () => {
    expect(holdsReportPublish({ permissions: ["poll.run"] })).toBe(false);
  });

  it("is false for an empty or missing reply", () => {
    expect(holdsReportPublish({ permissions: [] })).toBe(false);
    expect(holdsReportPublish({})).toBe(false);
    expect(holdsReportPublish(undefined)).toBe(false);
    expect(holdsReportPublish({ permissions: "report.publish" })).toBe(false);
  });
});

describe("closedFormIdOf", () => {
  it("picks the closed form of that title, ignoring case and spaces", () => {
    expect(closedFormIdOf(forms, "Arrival")).toBe("f-closed");
  });

  it("ignores open forms and other titles", () => {
    expect(closedFormIdOf(forms.slice(0, 2), "Arrival")).toBeNull();
    expect(closedFormIdOf(forms, "Missing")).toBeNull();
    expect(closedFormIdOf([], "Arrival")).toBeNull();
  });

  it("picks the closed form out of a forms_form_list reply of rows", () => {
    expect(closedFormIdOf(formListReply, "Arrival")).toBe("f-closed");
  });
});

describe("mcpPublishClient", () => {
  it("holds asks agency_get_my_roles", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ permissions: ["report.publish"] });
    expect(await mcpPublishClient.holds()).toBe(true);
    expect(call).toHaveBeenCalledWith("", "agency_get_my_roles", {});
  });

  it("closedFormId lists forms and picks the closed one", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: forms });
    expect(await mcpPublishClient.closedFormId("Arrival")).toBe("f-closed");
    expect(call).toHaveBeenCalledWith("", "forms_form_list", {});
  });

  it("closedFormId reads the id from a reply of rows", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue(formListReply);
    expect(await mcpPublishClient.closedFormId("Arrival")).toBe("f-closed");
    expect(call).toHaveBeenCalledWith("", "forms_form_list", {});
  });

  it("publish sends form_id, git_path and git_commit and maps the reply", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ version: 2, git_path: "reports/arrivals.pdf", published_at: "2026-11-13T09:30:00Z" });
    const report = await mcpPublishClient.publish("f1", "reports/arrivals.pdf", "abc123");
    expect(call).toHaveBeenCalledWith("", "forms_results_publish", { form_id: "f1", git_path: "reports/arrivals.pdf", git_commit: "abc123" });
    expect(report).toEqual({ version: 2, gitPath: "reports/arrivals.pdf", publishedAt: "2026-11-13T09:30:00Z" });
  });

  it("latest maps the read reply", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ version: 1, git_path: "a.pdf", published_at: "2026-11-12T08:00:00Z" });
    expect(await mcpPublishClient.latest("f1")).toEqual({ version: 1, gitPath: "a.pdf", publishedAt: "2026-11-12T08:00:00Z" });
    expect(call).toHaveBeenCalledWith("", "forms_results_read", { form_id: "f1" });
  });

  it("latest returns null when the tool throws", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("no report"));
    expect(await mcpPublishClient.latest("f1")).toBeNull();
  });
});
