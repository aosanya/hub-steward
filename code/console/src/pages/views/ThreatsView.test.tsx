import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { openLibrary } from "../library/libraryTesting";
import { callsOf } from "../spec/profileTesting";
import { ThreatsView } from "./ThreatsView";

vi.mock("../../wakala/mcp");

const rows = [
  { id: "p1", code: "X-1", title: "First", description: "About first" },
  { id: "p2", code: "X-2", title: "Second" },
];

const replies = (more: Record<string, unknown> = {}) => ({
  agency_list_threats: { items: rows },
  agency_list_risks: { items: [{ id: "r1", code: "RK-1", title: "Spoilage", threat_code: "X-1", hazard_code: "X-1" }] },
  agency_list_risk_threats: { items: [{ risk_code: "RK-1", threat_code: "X-1" }, { risk_code: "RK-2", threat_code: "X-1" }] },
  agency_list_unguarded_parts: { items: [{ code: "X-2" }] },
  ...more,
});

const open = (search = "", more: Record<string, unknown> = {}) => openLibrary(<ThreatsView />, "threats", replies(more), search);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Threats page", () => {
  it("is titled Threats with one Add a threat button and no tab strip", async () => {
    await open();
    expect(await screen.findByText("X-1 · First")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Threats" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add a threat" })).toHaveLength(1);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("shows each row with its related bowties", async () => {
    await open();
    await screen.findByText("X-1 · First");
    await userEvent.click(screen.getByRole("button", { name: "X-1 · First" }));
    expect(screen.getByText("About first")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Spoilage" })).toHaveAttribute("href", expect.stringContaining("risk=r1"));
    expect(screen.getByRole("link", { name: "RK-2" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "X-2 · Second" }));
    expect(screen.getAllByText("None", { exact: false }).length).toBeGreaterThan(0);
  });

  it("writes a new row straight to the draft", async () => {
    const user = await open("?add=1", { agency_create_threat: {} });
    await user.type(await screen.findByLabelText("Title"), "  Fresh ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_create_threat")).toHaveLength(1));
    expect(callsOf("agency_create_threat")[0]).toMatchObject({ title: "Fresh" });
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("asks for a title and writes nothing without it", async () => {
    const user = await open("?add=1");
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required: Title")).toBeInTheDocument();
    expect(callsOf("agency_create_threat")).toEqual([]);
  });

  it("edits a row in an inline form", async () => {
    const user = await open("?open=p1", { agency_update_threat: {} });
    const title = await screen.findByLabelText("Title");
    expect(title).toHaveValue("First");
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_update_threat")).toHaveLength(1));
    expect(callsOf("agency_update_threat")[0]).toMatchObject({ threat_id: "p1", title: "Renamed" });
  });

  it("deletes an unused row", async () => {
    const user = await open("", { agency_delete_threat: {} });
    await screen.findByText("X-2 · Second");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    await vi.waitFor(() => expect(callsOf("agency_delete_threat")).toEqual([{ threat_id: "p2" }]));
  });

  it("shows the tool's refusal when a delete is refused", async () => {
    const user = await open("", { agency_delete_threat: () => { throw new Error("In use by 2 bowties"); } });
    await screen.findByText("X-1 · First");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(await screen.findByText("In use by 2 bowties")).toBeInTheDocument();
  });

  it("says so when the list cannot be read", async () => {
    await open("", { agency_list_threats: () => { throw new Error("offline"); } });
    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
  });
});
