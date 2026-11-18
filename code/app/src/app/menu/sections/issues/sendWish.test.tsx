import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { SendWishScreen } from "./SendWishScreen";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let refusal: string;

const show = () =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/issues/send-wish"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/issues/send-wish" element={<SendWishScreen />} />
        <Route path="/a/:agencyId/menu/issues" element={<p>the issues section</p>} />
      </Routes>
    </MemoryRouter>,
  );

const raiseCalls = () => called.mock.calls.filter(([, tool]) => tool === "forms_catalog_raised_item_raise");

beforeEach(() => {
  openAgency("town");
  refusal = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "forms_catalog_raised_item_raise") {
      if (refusal) throw new mcp.McpError(refusal);
      return { id: "r1" };
    }
    throw new Error(`${tool} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Send a wish form", () => {
  it("offers Give my name and Stay anonymous, with Give my name chosen to begin with", () => {
    show();

    expect(screen.getByRole("button", { name: "Give my name", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay anonymous", pressed: false })).toBeInTheDocument();
  });

  it("keeps Send closed until the wish has a title", async () => {
    const user = userEvent.setup();
    show();

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    await user.type(screen.getByLabelText("Your wish"), "Lights along Kossuth utca");

    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("sends a named wish with anonymous false", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByLabelText("Your wish"), "Lights along Kossuth utca");
    await user.type(screen.getByLabelText("Topic (optional)"), "Street lighting");
    await user.type(screen.getByLabelText("Street (optional)"), "Kossuth utca");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(raiseCalls()).toEqual([["", "forms_catalog_raised_item_raise", { title: "Lights along Kossuth utca", topic: "Street lighting", street: "Kossuth utca", anonymous: false }]]);
    expect(await screen.findByText("Your wish was sent.")).toBeInTheDocument();
  });

  it("sends an anonymous wish with anonymous true and leaves out the answers left blank", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByLabelText("Your wish"), "A bench by the bus stop");
    await user.click(screen.getByRole("button", { name: "Stay anonymous" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(raiseCalls()).toEqual([["", "forms_catalog_raised_item_raise", { title: "A bench by the bus stop", anonymous: true }]]);
    expect(await screen.findByText("Your wish was sent.")).toBeInTheDocument();
  });

  it("says what the hub refused and keeps what was typed", async () => {
    const user = userEvent.setup();
    refusal = "not allowed to raise an item";
    show();

    await user.type(screen.getByLabelText("Your wish"), "A bench by the bus stop");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not allowed to raise an item");
    expect(screen.getByLabelText("Your wish")).toHaveValue("A bench by the bus stop");
  });

  it("offers to send another wish once one is sent", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByLabelText("Your wish"), "A bench by the bus stop");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(await screen.findByRole("button", { name: "Send another wish" }));

    expect(screen.getByLabelText("Your wish")).toHaveValue("");
  });

  it("goes back to the Issues & Requests section", async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole("button", { name: /Issues/ }));

    expect(screen.getByText("the issues section")).toBeInTheDocument();
  });
});
