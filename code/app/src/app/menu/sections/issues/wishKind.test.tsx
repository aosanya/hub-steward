import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { WishesScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const wishes = [
  { id: "w1", title: "Potholes on Petofi utca", kind: "complaint", raised_by: 2, me_too: 1 },
  { id: "w2", title: "A playground in Kertvaros", kind: "idea", raised_by: 4, me_too: 3 },
  { id: "w3", title: "Bus stop by the school", kind: "", raised_by: 1, me_too: 0 },
];

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "forms_catalog_board_item_list") return { items: wishes };
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/issues/wishes"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/issues/wishes" element={<WishesScreen />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe("each wish says whether it is a complaint or an idea", () => {
  it("names the kind in the list line, before the counts", async () => {
    open();

    expect(await screen.findByText(/Complaint · raised by 2/)).toBeInTheDocument();
    expect(screen.getByText(/Idea · raised by 4/)).toBeInTheDocument();
  });

  it("names no kind for a wish that has none", async () => {
    open();
    await screen.findByText("Bus stop by the school");

    expect(screen.getByText(/^raised by 1/)).toBeInTheDocument();
  });

  it("shows the kind in the opened wish and keeps one list", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: /A playground in Kertvaros/ }));
    const detail = document.querySelector(".mw-detail") as HTMLElement;

    expect(await within(detail).findByText("Kind")).toBeInTheDocument();
    expect(within(detail).getByText("Idea")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /raised by|Complaint|Idea/ }).length).toBeGreaterThanOrEqual(1);
  });
});
