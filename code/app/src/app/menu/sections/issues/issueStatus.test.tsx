import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AllIssuesScreen } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Row = Record<string, unknown>;

const nearbyRow: Row = { id: "i1", title: "Sample street light out", street: "Sample Street", area: "Sample Ward", department: "Sample Works", raised_by: "p1", anonymous: false, board_item_id: "b1" };

const replies = [{ id: "r1", raised_item_id: "i1", body: "A crew is booked.", created_at: "2026-11-16T12:00:00Z" }];

let permissions: string[];
let row: Row;
let personName: string;
let outcome: string;
let called: MockInstance<typeof mcp.callTool>;

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "forms_catalog_raised_item_list_nearby") return { items: [row] };
  if (name === "forms_catalog_raised_item_list_of_person") return { items: [{ id: "i1", status: "open", department: "Sample Works" }] };
  if (name === "forms_catalog_setting_read") return { value: "streetlights" };
  if (name === "forms_catalog_reply_list") return { items: replies };
  if (name === "forms_catalog_board_item_list") return { items: [{ id: "b1", title: "Lamps out on Sample Road", raised_by: 3 }] };
  if (name === "forms_catalog_board_item_read") return { id: "b1", outcome };
  if (name === "forms_catalog_board_item_set_outcome") return {};
  if (name === "forms_catalog_raised_item_ungroup") return {};
  if (name === "actor_get_actor") return { id: "p1", display_name: personName };
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  permissions = ["board.manage", "resident.read"];
  row = { ...nearbyRow };
  personName = "Sample Person";
  outcome = "";
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
        <Route path="/a/:agencyId/menu/residents/people" element={<p>Resident page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Sample street light out/ }));
  return document.querySelector(".mw-detail") as HTMLElement;
};

describe("All Issues carries the status its nearby rows lack", () => {
  it("reads the status from the raiser's items and puts it in the quiet line and the Status row", async () => {
    const page = await openPage();

    await waitFor(() => expect(page.querySelector(".quiet-line")?.textContent).toBe("open · Sample Street, Sample Ward"));
    const card = await within(page).findByRole("region", { name: "Issue" });
    expect(within(card).getByText("Status")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", "forms_catalog_raised_item_list_of_person", { raised_by: "p1" });
  });

  it("shows the status as a light tag on each list row with the place as the lighter line", async () => {
    await openPage();

    const list = document.querySelector(".mw-list") as HTMLElement;
    const listRow = (await within(list).findByRole("button", { name: /Sample street light out/ })) as HTMLElement;
    await waitFor(() => expect(listRow.querySelector(".chip")?.textContent).toBe("open"));
    expect(within(listRow).getByText("Sample Street, Sample Ward")).toBeInTheDocument();
  });

  it("keeps the page and shows no status when the raiser's items cannot be read", async () => {
    called.mockImplementation(async (_agency, name) => {
      if (name === "forms_catalog_raised_item_list_of_person") throw new mcp.McpError("forms_catalog_raised_item_list_of_person: refused");
      return answer(name);
    });
    const page = await openPage();

    expect(await within(page).findByRole("heading", { level: 1, name: "Sample street light out" })).toBeInTheDocument();
    expect(page.querySelector(".quiet-line")?.textContent).toBe("Sample Street, Sample Ward");
  });
});

describe("the Raised by card", () => {
  it("shows the resident as a row that opens their page", async () => {
    const page = await openPage();

    const card = await within(page).findByRole("region", { name: "Raised by" });
    await userEvent.click(await within(card).findByRole("button", { name: /Sample Person/ }));

    expect(await screen.findByText("Resident page")).toBeInTheDocument();
  });

  it("shows a neutral word, never the id, when the resident has no name", async () => {
    personName = "";
    const page = await openPage();

    const card = await within(page).findByRole("region", { name: "Raised by" });
    expect(await within(card).findByText("Unnamed person")).toBeInTheDocument();
    expect(card.textContent).not.toContain("p1");
  });

  it("says Anonymous without a link when the issue was raised anonymously", async () => {
    row = { ...nearbyRow, anonymous: true };
    const page = await openPage();

    const card = await within(page).findByRole("region", { name: "Raised by" });
    expect(within(card).getByText("Anonymous")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Anonymous/ })).toBeNull();
    expect(called).not.toHaveBeenCalledWith("", "actor_get_actor", expect.anything());
  });

  it("is not there for a seat that may not read residents", async () => {
    permissions = ["board.manage"];
    const page = await openPage();

    await within(page).findByRole("region", { name: "Issue" });
    expect(within(page).queryByRole("region", { name: "Raised by" })).toBeNull();
    expect(called).not.toHaveBeenCalledWith("", "actor_get_actor", expect.anything());
  });
});

describe("the Wish card carries its own acts", () => {
  it("holds the wish row and Ungroup and Edit outcome in its footer", async () => {
    const page = await openPage();

    const card = await within(page).findByRole("region", { name: "Wish" });
    expect(within(card).getByText("Lamps out on Sample Road")).toBeInTheDocument();
    const foot = card.querySelector(".sec-foot") as HTMLElement;
    expect(within(foot).getByRole("button", { name: "Ungroup" })).toBeInTheDocument();
    expect(within(foot).getByRole("button", { name: "Edit outcome" })).toBeInTheDocument();
    expect(page.querySelectorAll(":scope .sections > button").length).toBe(0);
  });

  it("shows the outcome as a row of the Wish card", async () => {
    outcome = "Lamp replaced";
    const page = await openPage();

    const card = await within(page).findByRole("region", { name: "Wish" });
    expect(await within(card).findByText("Lamp replaced")).toBeInTheDocument();
  });

  it("saves the outcome from the footer's sheet with the same tool call", async () => {
    const page = await openPage();

    await userEvent.click(await within(page).findByRole("button", { name: "Edit outcome" }));
    const sheet = await screen.findByRole("dialog", { name: "Edit outcome" });
    await userEvent.type(within(sheet).getByRole("textbox", { name: /Outcome/ }), "Lamp replaced");
    await userEvent.click(within(sheet).getByRole("button", { name: /Save/ }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_board_item_set_outcome", { boardItemID: "b1", outcome: "Lamp replaced" }));
  });

  it("ungroups from the footer with the same tool call", async () => {
    const page = await openPage();

    await userEvent.click(await within(page).findByRole("button", { name: "Ungroup" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "forms_catalog_raised_item_ungroup", { raisedItemID: "i1" }));
  });
});

describe("a reply reads like the mockup", () => {
  it("prints its day in words", async () => {
    const page = await openPage();

    const card = await within(page).findByRole("region", { name: "Replies" });
    expect(await within(card).findByText("Monday, 16 Nov")).toBeInTheDocument();
  });
});
