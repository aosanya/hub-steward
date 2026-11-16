import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { IssueScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let refusal: string;

const issue = { id: "i1", title: "Broken streetlight", status: "open", department: "Roads", boardItemId: "b1" };

beforeEach(() => {
  openAgency("town");
  permissions = ["board.manage"];
  refusal = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "forms_catalog_reply_list") return { items: [] };
    if (name === "forms_catalog_raised_item_reassign" || name === "forms_catalog_board_item_set_outcome") {
      if (refusal) throw new mcp.McpError(refusal);
      return {};
    }
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openIssue = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/a/town/menu/issues/all/i1", state: { issue } }]}>
      <Routes>
        <Route path="/a/:agencyId/menu/issues/all/:id" element={<IssueScreen />} />
      </Routes>
    </MemoryRouter>,
  );

describe("editing an issue from its screen", () => {
  it("lets a caller with board.manage hand it to another department and shows the new one", async () => {
    openIssue();
    await screen.findByText("Roads");

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    const department = screen.getByLabelText("Department");
    await userEvent.clear(department);
    await userEvent.type(department, "Lighting");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_raised_item_reassign", { raisedItemID: "i1", department: "Lighting" }));
    expect(await screen.findByText("Lighting")).toBeTruthy();
    expect(screen.queryByText("Roads")).toBeNull();
  });

  it("records the outcome on the board item", async () => {
    openIssue();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[1]);
    await userEvent.type(screen.getByLabelText("Outcome"), "Lamp replaced");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_board_item_set_outcome", { boardItemID: "b1", outcome: "Lamp replaced" }));
    expect(await screen.findByText("Lamp replaced")).toBeTruthy();
  });

  it("shows the hub's words when it refuses and keeps the old department", async () => {
    refusal = "forms_catalog_raised_item_reassign: only an officer may hand an item on";
    openIssue();

    await userEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    await userEvent.type(screen.getByLabelText("Department"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("only an officer may hand an item on")).toBeTruthy();
    expect(screen.getByText("Roads")).toBeTruthy();
  });

  it("shows no Edit to a caller without board.manage, the resident who raised it included", async () => {
    permissions = ["board_item.reply"];
    openIssue();

    await screen.findByText("Roads");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
