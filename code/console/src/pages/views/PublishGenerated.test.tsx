import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { PublishView } from "./PublishView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const generated = (id: string, code: string, name: string) => ({ id, code, name, generated: true, generated_for: code.split(".")[0] });

const complete = [
  generated("g1", "RC-1.add", "Add a tender"),
  generated("g2", "RC-1.edit", "Edit a tender"),
  generated("g3", "RC-1.delete", "Delete a tender"),
  generated("g4", "RC-2.add", "Add a project"),
  generated("g5", "RC-2.edit", "Edit a project"),
  generated("g6", "RC-2.delete", "Delete a project"),
];

const hub = (workflows: unknown[]) => ({
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_approvals: { items: [] },
  agency_list_publications: { items: [] },
  agency_list_scenarios: { items: [] },
  agency_list_issues: { items: [] },
  agency_publish_agency: { version: 1, tag: "v1", published_at: "2026-10-30T10:00:00Z" },
  agency_list_workflows: { items: workflows },
  agency_list_records: {
    items: [
      { id: "rec1", code: "RC-1", name: "Tenders", role_id: "r1" },
      { id: "rec2", code: "RC-2", name: "Projects", role_id: "r1" },
    ],
  },
  agency_list_roles: { items: [{ id: "r1", name: "Bid coordinator" }] },
});

const show = (workflows: unknown[]) => {
  answering(hub(workflows));
  return renderView("publish", PublishView);
};

const section = async () => within((await screen.findByRole("heading", { level: 2, name: "Generated workflows" })).closest("section") as HTMLElement);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Publish page's generated workflows check", () => {
  it("counts six of six and links each workflow of each record when none is missing", async () => {
    show(complete);

    const check = await section();

    expect(check.getByText("6 of 6")).toBeInTheDocument();
    expect(check.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Record", "Add", "Edit", "Delete", ""]);
    expect(check.getByRole("link", { name: "RC-2.delete" })).toHaveAttribute("href", "/h/h1/workflows-generated?open=g6");
    expect(check.getByRole("link", { name: "RC-2.delete" })).toHaveClass("cell-name");
    expect(check.getAllByRole("link", { name: "Open the record" })[1]).toHaveAttribute("href", "/h/h1/records?record=RC-2");
    expect(check.queryByText(/missing/)).not.toBeInTheDocument();
  });

  it("marks the missing workflow, counts five of six and still lets Publish be pressed", async () => {
    show(complete.slice(0, 5));

    const check = await section();

    expect(check.getByText("5 of 6")).toBeInTheDocument();
    expect(check.getByText("RC-2.delete missing")).toHaveClass("tag", "bad");
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("refuses to publish with the record and the workflow named, opens the record and sends nothing", async () => {
    show(complete.slice(0, 5));
    await section();

    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Record Projects (RC-2) has no generated workflow RC-2.delete.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open the record" }).some((link) => link.getAttribute("href") === "/h/h1/records?record=RC-2")).toBe(true);
    expect(callsTo("agency_publish_agency")).toEqual([]);
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("publishes when every record has its three", async () => {
    show(complete);
    await section();

    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Published as version 1")).toBeInTheDocument();
  });

  it("draws no check while the agency has no record", async () => {
    answering({ ...hub([]), agency_list_records: { items: [] } });
    renderView("publish", PublishView);

    await screen.findByRole("button", { name: "Publish" });

    expect(screen.queryByRole("heading", { level: 2, name: "Generated workflows" })).not.toBeInTheDocument();
  });
});
