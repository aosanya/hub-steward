import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { openLibrary } from "../library/libraryTesting";
import { callsOf } from "../spec/profileTesting";
import { ConsequencesView } from "./ConsequencesView";

vi.mock("../../wakala/mcp");

const rows = [
  { id: "p1", code: "X-1", title: "First", description: "About first", hazard_code: "H-2" },
  { id: "p2", code: "X-2", title: "Second", hazard_code: "H-1" },
];

const replies = (more: Record<string, unknown> = {}) => ({
  agency_list_consequences: { items: rows },
  agency_list_hazards: { items: [{ id: "h1", code: "H-1", title: "Flood" }, { id: "h2", code: "H-2", title: "Fire" }] },
  agency_list_risks: { items: [{ id: "r1", code: "RK-1", title: "Spoilage", consequence_code: "X-1", hazard_code: "X-1" }] },
  agency_list_risk_consequences: { items: [{ risk_code: "RK-1", consequence_code: "X-1" }, { risk_code: "RK-2", consequence_code: "X-1" }] },
  agency_list_unguarded_parts: { items: [{ code: "X-2" }] },
  ...more,
});

const open = (search = "", more: Record<string, unknown> = {}) => openLibrary(<ConsequencesView />, "consequences", replies(more), search);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Consequences page", () => {
  it("is titled Consequences with one Add a consequence button and no tab strip", async () => {
    await open();
    expect(await screen.findByText("X-1 · First")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Consequences" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add a consequence" })).toHaveLength(1);
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
    const user = await open("?add=1", { agency_create_consequence: {} });
    await user.selectOptions(await screen.findByLabelText("Hazard"), "H-1");
    await user.type(screen.getByLabelText("Title"), "  Fresh ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_create_consequence")).toHaveLength(1));
    expect(callsOf("agency_create_consequence")[0]).toMatchObject({ title: "Fresh", hazard_code: "H-1" });
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("asks for a title and writes nothing without it", async () => {
    const user = await open("?add=1");
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required: Title")).toBeInTheDocument();
    expect(callsOf("agency_create_consequence")).toEqual([]);
  });

  it("asks for a hazard and writes nothing without it", async () => {
    const user = await open("?add=1");
    await user.type(await screen.findByLabelText("Title"), "Fresh");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required: Hazard")).toBeInTheDocument();
    expect(callsOf("agency_create_consequence")).toEqual([]);
  });

  it("says to add a hazard first instead of the form when there are none", async () => {
    await open("?add=1", { agency_list_hazards: { items: [] } });
    expect(await screen.findByText("Add a hazard first")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("preselects the current hazard on edit and sends a changed one", async () => {
    const user = await open("?open=p1", { agency_update_consequence: {} });
    const hazard = await screen.findByLabelText("Hazard");
    await vi.waitFor(() => expect(hazard).toHaveValue("H-2"));
    await user.selectOptions(hazard, "H-1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_update_consequence")).toHaveLength(1));
    expect(callsOf("agency_update_consequence")[0]).toMatchObject({ consequence_id: "p1", hazard_code: "H-1" });
  });

  it("edits a row in an inline form", async () => {
    const user = await open("?open=p1", { agency_update_consequence: {} });
    const title = await screen.findByLabelText("Title");
    expect(title).toHaveValue("First");
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_update_consequence")).toHaveLength(1));
    expect(callsOf("agency_update_consequence")[0]).toMatchObject({ consequence_id: "p1", title: "Renamed" });
  });

  it("deletes an unused row", async () => {
    const user = await open("", { agency_delete_consequence: {} });
    await screen.findByText("X-2 · Second");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    await vi.waitFor(() => expect(callsOf("agency_delete_consequence")).toEqual([{ consequence_id: "p2" }]));
  });

  it("shows the tool's refusal when a delete is refused", async () => {
    const user = await open("", { agency_delete_consequence: () => { throw new Error("In use by 2 bowties"); } });
    await screen.findByText("X-1 · First");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(await screen.findByText("In use by 2 bowties")).toBeInTheDocument();
  });

  it("says so when the list cannot be read", async () => {
    await open("", { agency_list_consequences: () => { throw new Error("offline"); } });
    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
  });
});
