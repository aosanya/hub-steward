import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, renderPage } from "../spec/profileTesting";
import { ControlsView } from "../views/ControlsView";

vi.mock("../../wakala/mcp");

const open = async (attachments: Record<string, unknown>[]) => {
  answerWith({
    agency_list_controls: { items: [{ id: "c1", code: "C-1", text: "Grade every listing" }] },
    agency_list_control_attachments: { items: attachments },
    agency_list_threats: { items: [{ id: "t1", code: "T-1", title: "No bids" }, { id: "t2", code: "T-2", title: "Low offers" }] },
    agency_list_consequences: { items: [{ id: "q1", code: "Q-1", title: "Spoilage" }] },
    agency_list_workflows: { items: [] },
    agency_create_draft: { id: "d1" },
    agency_attach_control: { id: "a9" },
    agency_detach_control: {},
  });
  renderPage(<ControlsView />, "controls", "?control=c1");
  return userEvent.setup();
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("where a control stands", () => {
  it("lists the threats and consequences it is attached to", async () => {
    await open([{ id: "a1", target_type: "threat", target_code: "T-1" }, { id: "a2", target_type: "role", target_code: "R-1" }]);
    expect(await screen.findByText("No bids")).toBeInTheDocument();
    expect(screen.queryByText("R-1")).toBeNull();
    expect(screen.queryByText(/Avoid this/)).toBeNull();
  });

  it("attaches a picked consequence", async () => {
    const user = await open([]);
    await user.selectOptions(await screen.findByRole("combobox", { name: "Pick a threat or consequence" }), "consequence:q1");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await vi.waitFor(() => expect(callsOf("agency_attach_control")).toEqual([{ control_id: "c1", target_type: "consequence", target_id: "q1" }]));
  });

  it("warns when it stands on more than one", async () => {
    await open([{ id: "a1", target_type: "threat", target_code: "T-1" }, { id: "a2", target_type: "threat", target_code: "T-2" }]);
    expect(await screen.findByText(/Avoid this where you can/)).toBeInTheDocument();
  });

  it("detaches one", async () => {
    const user = await open([{ id: "a1", target_type: "threat", target_code: "T-1" }]);
    await user.click(await screen.findByRole("button", { name: "Detach from this control" }));
    await vi.waitFor(() => expect(callsOf("agency_detach_control")).toEqual([{ attachment_id: "a1" }]));
  });
});
