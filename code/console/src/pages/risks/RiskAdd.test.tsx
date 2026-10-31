import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, renderPage } from "../spec/profileTesting";
import { RisksView } from "../views/RisksView";

vi.mock("../../wakala/mcp");

const open = async (search: string, more: Record<string, unknown> = {}) => {
  answerWith({
    agency_list_risks: { items: [] },
    agency_create_draft: { id: "d1" },
    agency_create_risk: { id: "r1" },
    ...more,
  });
  renderPage(<RisksView />, "risks", search);
  return userEvent.setup();
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("adding a risk", () => {
  it("offers the button in the page header and in the empty card", async () => {
    await open("");
    expect(await screen.findByText("No risks yet.")).toBeInTheDocument();
    const buttons = screen.getAllByRole("link", { name: "Add a risk" });
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => expect(button).toHaveAttribute("href", expect.stringContaining("?add=risk")));
  });

  it("keeps only the header button once risks exist", async () => {
    await open("", {
      agency_list_risks: { items: [{ id: "r2", code: "RK-2", title: "Data leak", top_event: "A leak" }] },
      agency_list_risk_pathways: { items: [] },
    });
    expect(await screen.findByRole("button", { name: "RK-2 · Data leak" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add a risk" })).toHaveLength(1);
  });

  it("saves straight to the draft without asking for approval", async () => {
    const user = await open("?add=risk");
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "  Data leak ");
    await user.type(screen.getByRole("textbox", { name: "Top event" }), "A leak");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(callsOf("agency_create_risk")).toHaveLength(1));
    expect(callsOf("agency_create_risk")[0]).toEqual({ draft_id: "d1", title: "Data leak", top_event: "A leak" });
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("asks for a title and writes nothing without one", async () => {
    const user = await open("?add=risk");
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Required: Title")).toBeInTheDocument();
    expect(callsOf("agency_create_risk")).toEqual([]);
  });

  it("says so when the draft refuses the risk", async () => {
    const user = await open("?add=risk", { agency_create_risk: () => { throw new Error("no"); } });
    await user.type(await screen.findByRole("textbox", { name: "Title" }), "Data leak");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
