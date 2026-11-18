import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { settingsPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let stored: Record<string, string>;

let permissions: string[];

beforeEach(() => {
  stored = {};
  permissions = ["permission.override"];
  openAgency("town");
  setWide(true);
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const given = (args ?? {}) as Record<string, string>;
    if (tool === "forms_catalog_setting_read") return given.key in stored ? { key: given.key, value: stored[given.key] } : null;
    if (tool === "forms_catalog_setting_write") {
      stored[given.key] = given.value;
      return {};
    }
    if (tool === "agency_get_my_roles") return { permissions };
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const Where = () => {
  const at = useLocation();
  return <p data-testid="where">{`${at.pathname}${at.search}`}</p>;
};

const openPath = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        {routes()}
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

const listPath = () => items.find((item) => item.title === "Details of a record")!.path!();

const openRecord = (code: string) => openPath(`${listPath()}?item=${code}`);

const openEdit = (code: string) => openPath(settingsPaths.registerDetailsEdit.path({ id: code }));

describe("the Details of a record list", () => {
  it("lists Businesses, Informal traders, Residents and Holdings in a panel on the left", async () => {
    openPath(listPath());

    const list = await screen.findByRole("region", { name: "Records" });
    for (const name of ["Businesses", "Informal traders", "Residents", "Holdings"]) expect(await within(list).findByText(name)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("gives each record a quiet line saying how many of its details are on", async () => {
    openPath(listPath());

    const list = await screen.findByRole("region", { name: "Records" });
    expect(await within(list).findAllByText("8 of 8 details on")).toHaveLength(2);
    expect(within(list).getAllByText("3 of 3 details on")).toHaveLength(2);
  });

  it("opens a record's page on the right when it is chosen", async () => {
    openPath(listPath());

    await userEvent.click(await screen.findByRole("button", { name: /Residents/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Residents" })).toBeInTheDocument();
  });
});

describe("a record's page", () => {
  it("has the record as its title, one quiet line and a Details card of plain label and value rows", async () => {
    openRecord("RC-1");

    expect(await screen.findByRole("heading", { level: 1, name: "Businesses" })).toBeInTheDocument();
    const card = await screen.findByRole("region", { name: "Details" });
    expect(within(card).getByText("Trading name")).toBeInTheDocument();
    expect(within(card).getByText("Always on and required")).toBeInTheDocument();
    expect(within(card).getByText("Tax number").closest("li, div")?.textContent).toContain("On, required");
    expect(within(card).getByText("Registration number").closest("li, div")?.textContent).toContain("On");
    expect(within(card).getByText("Registration number").closest("li, div")?.textContent).not.toContain("required");
  });

  it("has no checkbox, no New detail field and no Save details on the page itself", async () => {
    openRecord("RC-1");

    await screen.findByRole("region", { name: "Details" });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByLabelText("New detail")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save details" })).toBeNull();
  });

  it("names Edit details in the footer of the card for a caller who may, and hides it from one who may not", async () => {
    openRecord("RC-1");
    const card = await screen.findByRole("region", { name: "Details" });
    expect(await within(card).findByRole("button", { name: "Edit details" })).toBeInTheDocument();
    cleanup();

    permissions = ["member.view"];
    openRecord("RC-1");
    const bare = await screen.findByRole("region", { name: "Details" });
    await waitFor(() => expect(mcp.callTool).toHaveBeenCalledWith("", "agency_get_my_roles"));
    expect(within(bare).queryByRole("button", { name: "Edit details" })).toBeNull();
  });

  it("shows what was saved before: a switched-off Email reads Off for Residents", async () => {
    stored["register_details:RESIDENT"] = JSON.stringify({ details: [{ prompt: "Email", on: false, required: false, own: false }] });
    openRecord("RESIDENT");

    const card = await screen.findByRole("region", { name: "Details" });
    expect(await within(card).findByText("Off")).toBeInTheDocument();
    expect(within(card).getByText("Name").closest("li, div")?.textContent).toContain("Always on and required");
  });
});

describe("the one edit screen for a record's details", () => {
  it("opens from Edit details with each detail's On and Required ticks, today's details all on", async () => {
    openRecord("RC-1");
    const card = await screen.findByRole("region", { name: "Details" });
    await userEvent.click(await within(card).findByRole("button", { name: "Edit details" }));

    expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/details-of-a-record/RC-1/edit");
    expect(await screen.findByRole("checkbox", { name: "Tax number on" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Tax number required" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Registration number required" })).not.toBeChecked();
  });

  it("saves a required Registration number and an added Opening hours under the Businesses setting, then returns to the record", async () => {
    const user = userEvent.setup();
    openEdit("RC-1");

    await user.click(await screen.findByRole("checkbox", { name: "Registration number required" }));
    await user.type(screen.getByLabelText("New detail"), "Opening hours");
    await user.click(screen.getByRole("button", { name: "Add detail" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(stored).toHaveProperty("register_details:RC-1"));
    const details = JSON.parse(stored["register_details:RC-1"]).details;
    expect(details).toContainEqual({ prompt: "Opening hours", on: true, required: false, own: true });
    expect(details).toContainEqual({ prompt: "Registration number", on: true, required: true, own: false });
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/details-of-a-record?item=RC-1"));
  });

  it("keeps Informal traders apart from Businesses", async () => {
    const user = userEvent.setup();
    openEdit("RC-2");

    await user.click(await screen.findByRole("checkbox", { name: "Usual days on" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(stored).toHaveProperty("register_details:RC-2"));
    expect(stored).not.toHaveProperty("register_details:RC-1");
  });

  it("saves a switched-off Email and an added Preferred language under the Residents setting only", async () => {
    const user = userEvent.setup();
    openEdit("RESIDENT");

    expect(await screen.findByRole("checkbox", { name: "Name required" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Email on" }));
    await user.type(screen.getByLabelText("New detail"), "Preferred language");
    await user.click(screen.getByRole("button", { name: "Add detail" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(stored).toHaveProperty("register_details:RESIDENT"));
    const details = JSON.parse(stored["register_details:RESIDENT"]).details;
    expect(details).toContainEqual({ prompt: "Email", on: false, required: false, own: false });
    expect(details).toContainEqual({ prompt: "Preferred language", on: true, required: false, own: true });
    expect(Object.keys(stored)).toEqual(["register_details:RESIDENT"]);
  });

  it("keeps Property of a holding on and required, even when an earlier setting had switched it off", async () => {
    stored["register_details:HOLDING"] = JSON.stringify({ details: [{ prompt: "Property", on: false, required: false, own: false }] });
    openEdit("HOLDING");

    const on = await screen.findByRole("checkbox", { name: "Property on" });
    const required = screen.getByRole("checkbox", { name: "Property required" });
    expect(on).toBeChecked();
    expect(on).toBeDisabled();
    expect(required).toBeChecked();
    expect(required).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Kind on" })).toBeEnabled();
  });

  it("saves an added Water meter number under the Holdings setting only", async () => {
    const user = userEvent.setup();
    openEdit("HOLDING");

    await user.type(await screen.findByLabelText("New detail"), "Water meter number");
    await user.click(screen.getByRole("button", { name: "Add detail" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(stored).toHaveProperty("register_details:HOLDING"));
    expect(JSON.parse(stored["register_details:HOLDING"]).details).toContainEqual({ prompt: "Water meter number", on: true, required: false, own: true });
    expect(Object.keys(stored)).toEqual(["register_details:HOLDING"]);
  });

  it("changes nothing and returns to the record on Cancel", async () => {
    const user = userEvent.setup();
    openEdit("RC-1");

    await user.click(await screen.findByRole("checkbox", { name: "Registration number required" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(stored).toEqual({});
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/menu/settings/details-of-a-record?item=RC-1"));
  });

  it("shows nothing to change to a caller without the permission", async () => {
    permissions = ["member.view"];
    openEdit("RC-1");

    await waitFor(() => expect(mcp.callTool).toHaveBeenCalledWith("", "agency_get_my_roles"));
    expect(await screen.findByText("You may not change this.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
