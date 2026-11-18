import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { WishesScreen } from "./index";
import { issuePaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => (tool === "forms_catalog_board_item_list" ? { items: [{ id: "w1", title: "A bench by the bus stop", raised_by: 3, me_too: 2 }] } : { items: [] }));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = () =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/issues/wishes"]}>
      <Where />
      <Routes>
        <Route path="/a/:agencyId/menu/issues/wishes" element={<WishesScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe("the Wishes list", () => {
  it("carries the full-width Send a wish button above Search that opens the send screen", async () => {
    const user = userEvent.setup();
    show();
    await screen.findByText("A bench by the bus stop");
    const button = screen.getByRole("button", { name: "Send a wish" });
    expect(button.compareDocumentPosition(screen.getByLabelText("Search")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(button);
    expect(landed).toBe(issuePaths.sendWish.path());
  });
});
