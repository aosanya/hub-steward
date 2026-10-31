import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, renderPage } from "../spec/profileTesting";
import { RisksView } from "../views/RisksView";

vi.mock("../../wakala/mcp");

const risk = { id: "r2", code: "RK-2", title: "Data leak", top_event: "A leak", hazard: "Paper files", owner: "Chair" };

const open = async (more: Record<string, unknown> = {}) => {
  answerWith({
    agency_list_risks: { items: [risk] },
    agency_list_threats: { items: [{ id: "t1", code: "T-1", title: "Lost folder", control_codes: ["C-1"] }, { id: "t2", code: "T-2", title: "Phishing" }] },
    agency_list_consequences: { items: [{ id: "q1", code: "Q-1", title: "Fine" }] },
    agency_list_risk_threats: { items: [{ id: "l1", risk_code: "RK-2", threat_code: "T-1" }] },
    agency_list_risk_consequences: { items: [{ id: "l2", risk_code: "RK-2", consequence_code: "Q-1" }] },
    agency_list_hazards: { items: [] },
    agency_list_risk_pathways: { items: [] },
    agency_create_draft: { id: "d1" },
    agency_update_risk: { id: "r2" },
    agency_delete_risk: { id: "r2" },
    agency_create_threat: { id: "t3", code: "T-3" },
    agency_create_risk_threat: { id: "l9" },
    agency_delete_risk_threat: { id: "l1" },
    agency_delete_risk_pathway: { id: "p1" },
    ...more,
  });
  renderPage(<RisksView />, "risks", "?risk=r2");
  return userEvent.setup();
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("one risk", () => {
  it("shows the detail with threats and consequences", async () => {
    await open();
    expect(await screen.findByText("Threats · 1")).toBeInTheDocument();
    expect(screen.getByText("Consequences · 1")).toBeInTheDocument();
    expect(screen.getByText("Paper files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("tells the editor to add a hazard first when the library has none", async () => {
    const user = await open();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByText("Add a hazard first")).toBeInTheDocument();
  });

  it("gives no hazard hint in the editor when the library holds a hazard", async () => {
    const user = await open({ agency_list_hazards: { items: [{ id: "h1", code: "H-1", title: "Paper files" }] } });
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByRole("textbox", { name: "Title" });
    expect(await screen.findByRole("option", { name: "Paper files" })).toBeInTheDocument();
    expect(screen.queryByText("Add a hazard first")).not.toBeInTheDocument();
  });

  it("edits straight to the draft and reloads", async () => {
    const user = await open();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const title = await screen.findByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Data breach");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_update_risk")).toHaveLength(1));
    expect(callsOf("agency_update_risk")[0]).toEqual({
      draft_id: "d1",
      risk_id: "r2",
      title: "Data breach",
      top_event: "A leak",
      hazard: "Paper files",
      owner: "Chair",
    });
    expect(callsOf("agency_propose_write")).toEqual([]);
    await vi.waitFor(() => expect(callsOf("agency_list_risks").length).toBeGreaterThan(1));
  });

  it("asks for a title when editing", async () => {
    const user = await open();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.clear(await screen.findByRole("textbox", { name: "Title" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required: Title")).toBeInTheDocument();
    expect(callsOf("agency_update_risk")).toEqual([]);
  });

  it("deletes only after the confirm step", async () => {
    const user = await open();
    await user.click((await screen.findAllByRole("button", { name: "Delete" }))[0]);
    expect(callsOf("agency_delete_risk")).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Delete risk" }));
    await vi.waitFor(() => expect(callsOf("agency_delete_risk")).toHaveLength(1));
    expect(callsOf("agency_delete_risk")[0]).toEqual({ risk_id: "r2" });
  });

  it("links a library threat", async () => {
    const user = await open();
    await user.click(await screen.findByRole("button", { name: "Add a threat" }));
    expect(await screen.findByRole("combobox", { name: "From the library" })).toHaveValue("T-2");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_create_risk_threat")).toHaveLength(1));
    expect(callsOf("agency_create_risk_threat")[0]).toEqual({ draft_id: "d1", risk_code: "RK-2", threat_code: "T-2" });
    expect(callsOf("agency_create_threat")).toEqual([]);
  });

  it("creates a new library threat, then links it", async () => {
    const user = await open();
    await user.click(await screen.findByRole("button", { name: "Add a threat" }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "From the library" }), "");
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "Flood");
    await user.type(screen.getByRole("textbox", { name: "Description" }), "River rises");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_create_risk_threat")).toHaveLength(1));
    expect(callsOf("agency_create_threat")[0]).toEqual({ draft_id: "d1", title: "Flood", description: "River rises" });
    expect(callsOf("agency_create_risk_threat")[0]).toEqual({ draft_id: "d1", risk_code: "RK-2", threat_code: "T-3" });
  });

  it("unlinks a threat without deleting it", async () => {
    const user = await open();
    const buttons = await screen.findAllByRole("button", { name: "Remove from this risk" });
    await user.click(buttons[0]);
    await vi.waitFor(() => expect(callsOf("agency_delete_risk_threat")).toHaveLength(1));
    expect(callsOf("agency_delete_risk_threat")[0]).toEqual({ risk_threat_id: "l1" });
    expect(callsOf("agency_delete_threat")).toEqual([]);
  });

  it("unlinks a consequence without deleting it", async () => {
    const user = await open({ agency_delete_risk_consequence: { id: "l2" } });
    await user.click(await screen.findByRole("link", { name: /^Consequences/ }));
    await user.click((await screen.findAllByRole("button", { name: "Remove from this risk" }))[0]);
    await vi.waitFor(() => expect(callsOf("agency_delete_risk_consequence")).toHaveLength(1));
    expect(callsOf("agency_delete_risk_consequence")[0]).toEqual({ risk_consequence_id: "l2" });
    expect(callsOf("agency_delete_consequence")).toEqual([]);
  });

  it("deletes a legacy pathway when the draft has no library", async () => {
    const user = await open({
      agency_list_threats: { items: [] },
      agency_list_consequences: { items: [] },
      agency_list_risk_pathways: { items: [{ id: "p1", code: "RP-1", title: "Old" }] },
    });
    const buttons = await screen.findAllByRole("button", { name: "Delete" });
    await user.click(buttons[1]);
    await vi.waitFor(() => expect(callsOf("agency_delete_risk_pathway").length).toBeGreaterThan(0));
    expect(callsOf("agency_delete_risk_pathway")[0]).toEqual({ risk_pathway_id: "p1" });
  });

  it("lists only the consequences of the bowtie's hazard", async () => {
    const user = await open({
      agency_list_risks: { items: [{ ...risk, hazard_code: "H-1" }] },
      agency_list_risk_consequences: { items: [] },
      agency_list_consequences: {
        items: [
          { id: "q1", code: "Q-1", title: "Fine", hazard_code: "H-1" },
          { id: "q2", code: "Q-2", title: "Crop loss", hazard_code: "H-2" },
          { id: "q3", code: "Q-3", title: "Closure", hazard_code: "H-1" },
        ],
      },
    });
    await user.click(await screen.findByRole("link", { name: /^Consequences/ }));
    await user.click(await screen.findByRole("button", { name: "Add a consequence" }));
    const picker = await screen.findByRole("combobox", { name: "From the library" });
    await vi.waitFor(() => expect(within(picker).getAllByRole("option").map((one) => one.textContent)).toEqual(["Fine", "Closure", "Create new"]));
  });

  it("disables the consequence picker until the bowtie has a hazard", async () => {
    const user = await open({ agency_list_risk_consequences: { items: [] } });
    await user.click(await screen.findByRole("link", { name: /^Consequences/ }));
    await user.click(await screen.findByRole("button", { name: "Add a consequence" }));
    const picker = await screen.findByRole("combobox", { name: "From the library" });
    expect(picker).toBeDisabled();
    expect(within(picker).getByRole("option", { name: "Choose the bowtie's hazard first" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(callsOf("agency_create_risk_consequence")).toEqual([]);
  });

  it("gives a new consequence the bowtie's hazard", async () => {
    const user = await open({
      agency_list_risks: { items: [{ ...risk, hazard_code: "H-1" }] },
      agency_list_risk_consequences: { items: [] },
      agency_list_consequences: { items: [] },
      agency_create_consequence: { id: "q9", code: "Q-9" },
      agency_create_risk_consequence: { id: "l9" },
    });
    await user.click(await screen.findByRole("link", { name: /^Consequences/ }));
    await user.click(await screen.findByRole("button", { name: "Add a consequence" }));
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "Flood loss");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_create_risk_consequence")).toHaveLength(1));
    expect(callsOf("agency_create_consequence")[0]).toEqual({ draft_id: "d1", title: "Flood loss", description: "", hazard_code: "H-1" });
  });

  it("chooses the hazard from the library when editing", async () => {
    const user = await open({ agency_list_hazards: { items: [{ id: "h1", code: "H-1", title: "Flood" }] } });
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.selectOptions(await screen.findByRole("combobox", { name: "Hazard" }), "H-1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(callsOf("agency_update_risk")).toHaveLength(1));
    expect(callsOf("agency_update_risk")[0]).toMatchObject({ hazard: "Flood", hazard_code: "H-1" });
  });
});
