import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { openLibrary } from "../library/libraryTesting";
import { callsOf } from "../spec/profileTesting";
import { HazardsView } from "./HazardsView";

vi.mock("../../wakala/mcp");

const rows = [
  { id: "p1", code: "X-1", title: "First", description: "About first" },
  { id: "p2", code: "X-2", title: "Second" },
];

const replies = (more: Record<string, unknown> = {}) => ({
  agency_list_hazards: { items: rows },
  agency_list_risks: { items: [{ code: "RK-1", hazard_code: "X-1" }, { code: "RK-2", hazard_code: "X-1" }] },
    agency_list_unguarded_parts: { items: [{ code: "X-2" }] },
  ...more,
});

const open = (search = "", more: Record<string, unknown> = {}) => openLibrary(<HazardsView />, "hazards", replies(more), search);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Hazards page", () => {
  it("is titled Hazards with one Add a hazard button and no tab strip", async () => {
    await open();
    expect(await screen.findByText("X-1 · First")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hazards" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add a hazard" })).toHaveLength(1);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("shows each row with its code and description", async () => {
    await open();
    await screen.findByText("X-1 · First");
    await userEvent.click(screen.getByRole("button", { name: "X-1 · First" }));
    expect(screen.getByText("About first")).toBeInTheDocument();
  });

  it("writes a new row straight to the draft", async () => {
    const user = await open("?add=1", { agency_create_hazard: {} });
    await user.type(await screen.findByLabelText("Title"), "  Fresh ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_create_hazard")).toHaveLength(1));
    expect(callsOf("agency_create_hazard")[0]).toMatchObject({ title: "Fresh" });
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("asks for a title and writes nothing without it", async () => {
    const user = await open("?add=1");
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required: Title")).toBeInTheDocument();
    expect(callsOf("agency_create_hazard")).toEqual([]);
  });

  it("edits a row in an inline form", async () => {
    const user = await open("?open=p1", { agency_update_hazard: {} });
    const title = await screen.findByLabelText("Title");
    expect(title).toHaveValue("First");
    expect(screen.getByText("Edit the hazard")).toBeInTheDocument();
    expect(screen.queryByText("Add a hazard", { selector: "h2, h3, .card-title, summary" })).toBeNull();
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_update_hazard")).toHaveLength(1));
    expect(callsOf("agency_update_hazard")[0]).toMatchObject({ hazard_id: "p1", title: "Renamed" });
  });

  it("deletes an unused row", async () => {
    const user = await open("", { agency_delete_hazard: {} });
    await screen.findByText("X-2 · Second");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    await vi.waitFor(() => expect(callsOf("agency_delete_hazard")).toEqual([{ hazard_id: "p2" }]));
  });

  it("shows the tool's refusal when a delete is refused", async () => {
    const user = await open("", { agency_delete_hazard: () => { throw new Error("In use by 2 bowties"); } });
    await screen.findByText("X-1 · First");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(await screen.findByText("In use by 2 bowties")).toBeInTheDocument();
  });

  it("says so when the list cannot be read", async () => {
    await open("", { agency_list_hazards: () => { throw new Error("offline"); } });
    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
  });
});
