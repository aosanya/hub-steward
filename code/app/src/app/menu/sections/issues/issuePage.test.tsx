import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AllIssuesScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const issue = { id: "i1", title: "Sample street light out", status: "open", street: "Sample Street", area: "Sample Ward", department: "Sample Works" };

const replies = [{ id: "r1", raised_item_id: "i1", body: "A crew is booked.", created_at: "2026-03-04T12:00:00Z" }];

let permissions: string[];
let called: MockInstance<typeof mcp.callTool>;

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "forms_catalog_raised_item_list_nearby") return { items: [issue] };
  if (name === "forms_catalog_setting_read") return { value: "streetlights" };
  if (name === "forms_catalog_reply_list") return { items: replies };
  if (name === "forms_catalog_reply_send") return { id: "r2" };
  if (name === "forms_catalog_board_item_list") return { items: [] };
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  permissions = ["board.manage"];
  setWide(true);
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openPage = async () => {
  render(
    <MemoryRouter initialEntries={["/a/town/menu/issues/all"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/issues/all" element={<AllIssuesScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Sample street light out/ }));
  return document.querySelector(".mw-detail") as HTMLElement;
};

describe("an issue's page is built like the resident page", () => {
  it("has the title with the status and place on one quiet line, and no header band", async () => {
    const page = await openPage();

    expect(await within(page).findByRole("heading", { level: 1, name: "Sample street light out" })).toBeInTheDocument();
    expect(page.querySelector(".quiet-line")?.textContent).toBe("open · Sample Street, Sample Ward");
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("draws the main tab bar on a wide screen", async () => {
    await openPage();

    const bar = await screen.findByRole("navigation", { name: "Main" });
    expect(within(bar).getByRole("link", { name: /Chat/ })).toBeInTheDocument();
  });

  it("holds Status, Department and Place as plain rows in an Issue card with Edit department in its footer", async () => {
    const page = await openPage();

    const card = await within(page).findByRole("region", { name: "Issue" });
    expect(within(card).getByText("Status")).toBeInTheDocument();
    expect(within(card).getByText("Sample Works")).toBeInTheDocument();
    expect(within(card).getByText("Sample Street, Sample Ward")).toBeInTheDocument();
    expect(card.querySelector(".lead")).toBeNull();
    const foot = card.querySelector(".sec-foot") as HTMLElement;
    expect(within(foot).getByRole("button", { name: "Edit department" })).toBeInTheDocument();
  });

  it("shows no Edit department to a seat that may not manage the board", async () => {
    permissions = [];
    const page = await openPage();

    const card = await within(page).findByRole("region", { name: "Issue" });
    expect(within(card).queryByRole("button", { name: "Edit department" })).toBeNull();
    expect(card.querySelector(".sec-foot")?.textContent ?? "").toBe("");
  });

  it("saves the department from the footer's sheet", async () => {
    const page = await openPage();

    await userEvent.click(await within(page).findByRole("button", { name: "Edit department" }));
    const sheet = await screen.findByRole("dialog", { name: "Edit department" });
    const field = within(sheet).getByRole("textbox", { name: /Department/ });
    await userEvent.clear(field);
    await userEvent.type(field, "Sample Parks");
    await userEvent.click(within(sheet).getByRole("button", { name: /Save/ }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_raised_item_reassign", expect.objectContaining({ raisedItemID: "i1", department: "Sample Parks" })));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit department" })).toBeNull());
  });

  it("lists the replies as rows of a Replies card whose footer says Reply", async () => {
    const page = await openPage();

    const card = await within(page).findByRole("region", { name: "Replies" });
    expect(await within(card).findByText("A crew is booked.")).toBeInTheDocument();
    const foot = card.querySelector(".sec-foot") as HTMLElement;
    expect(within(foot).getByRole("button", { name: "Reply" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your reply" })).toBeNull();
  });

  it("writes and sends a reply from the Reply sheet, then loads the replies again", async () => {
    const page = await openPage();
    await within(page).findByText("A crew is booked.");
    const asked = () => called.mock.calls.filter(([, name]) => name === "forms_catalog_reply_list").length;
    const before = asked();

    await userEvent.click(within(page).getByRole("button", { name: "Reply" }));
    const sheet = await screen.findByRole("dialog", { name: "Reply" });
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Your reply" }), "Thank you, noted.");
    await userEvent.click(within(sheet).getByRole("button", { name: "Send reply" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_reply_send", expect.objectContaining({ raisedItemID: "i1", body: "Thank you, noted." })));
    await waitFor(() => expect(asked()).toBeGreaterThan(before));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Reply" })).toBeNull());
  });
});
