import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

let stored: Record<string, string>;

beforeEach(() => {
  stored = {};
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const given = (args ?? {}) as Record<string, string>;
    if (tool === "forms_catalog_setting_read") return given.key in stored ? { key: given.key, value: stored[given.key] } : null;
    if (tool === "forms_catalog_setting_write") {
      stored[given.key] = given.value;
      return {};
    }
    if (tool === "agency_get_my_roles") return { permissions: ["permission.override"] };
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const open = () =>
  render(
    <MemoryRouter initialEntries={[items.find((item) => item.title === "Details of a record")!.path!()]}>
      <Routes>
        {routes()}
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe("the Details of a record screen", () => {
  it("lists each detail of Businesses with On and Required ticks, today's details all on", async () => {
    open();

    expect(await screen.findByRole("checkbox", { name: "Tax number on" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Tax number required" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Registration number required" })).not.toBeChecked();
  });

  it("saves a required Registration number and an added Opening hours under the Businesses setting", async () => {
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("checkbox", { name: "Registration number required" }));
    await user.type(screen.getByLabelText("New detail"), "Opening hours");
    await user.click(screen.getByRole("button", { name: "Add detail" }));
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(stored).toHaveProperty("register_details:RC-1"));
    const details = JSON.parse(stored["register_details:RC-1"]).details;
    expect(details).toContainEqual({ prompt: "Opening hours", on: true, required: false, own: true });
    expect(details).toContainEqual({ prompt: "Registration number", on: true, required: true, own: false });
  });

  it("chooses Informal traders and keeps its details apart", async () => {
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("tab", { name: "Informal traders" }));
    await user.click(await screen.findByRole("checkbox", { name: "Usual days on" }));
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(stored).toHaveProperty("register_details:RC-2"));
    expect(stored).not.toHaveProperty("register_details:RC-1");
  });
});

describe("the Details of a record screen for residents and holdings", () => {
  it("offers Businesses, Informal traders, Residents and Holdings", async () => {
    open();

    await screen.findByRole("checkbox", { name: "Tax number on" });
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Businesses", "Informal traders", "Residents", "Holdings"]);
  });

  it("lists Name required and Phone and Email optional for Residents, all on", async () => {
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("tab", { name: "Residents" }));

    expect(await screen.findByRole("checkbox", { name: "Name required" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Phone on" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Phone required" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Email on" })).toBeChecked();
  });

  it("saves a switched-off Email and an added Preferred language under the Residents setting only", async () => {
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("tab", { name: "Residents" }));
    await user.click(await screen.findByRole("checkbox", { name: "Email on" }));
    await user.type(screen.getByLabelText("New detail"), "Preferred language");
    await user.click(screen.getByRole("button", { name: "Add detail" }));
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(stored).toHaveProperty("register_details:RESIDENT"));
    const details = JSON.parse(stored["register_details:RESIDENT"]).details;
    expect(details).toContainEqual({ prompt: "Email", on: false, required: false, own: false });
    expect(details).toContainEqual({ prompt: "Preferred language", on: true, required: false, own: true });
    expect(Object.keys(stored)).toEqual(["register_details:RESIDENT"]);
  });

  it("lists Property, Kind and Since for Holdings and saves an added Water meter number under the Holdings setting only", async () => {
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("tab", { name: "Holdings" }));
    expect(await screen.findByRole("checkbox", { name: "Property on" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Kind on" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Since on" })).toBeChecked();
    await user.type(screen.getByLabelText("New detail"), "Water meter number");
    await user.click(screen.getByRole("button", { name: "Add detail" }));
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(stored).toHaveProperty("register_details:HOLDING"));
    expect(JSON.parse(stored["register_details:HOLDING"]).details).toContainEqual({ prompt: "Water meter number", on: true, required: false, own: true });
    expect(Object.keys(stored)).toEqual(["register_details:HOLDING"]);
  });
});

describe("the Property detail of a holding", () => {
  it("shows as on and required and cannot be switched", async () => {
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("tab", { name: "Holdings" }));

    const on = await screen.findByRole("checkbox", { name: "Property on" });
    const required = screen.getByRole("checkbox", { name: "Property required" });
    expect(on).toBeChecked();
    expect(on).toBeDisabled();
    expect(required).toBeChecked();
    expect(required).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Kind on" })).toBeEnabled();
  });

  it("shows as on even when an earlier setting had switched it off", async () => {
    const user = userEvent.setup();
    stored["register_details:HOLDING"] = JSON.stringify({ details: [{ prompt: "Property", on: false, required: false, own: false }] });
    open();

    await user.click(await screen.findByRole("tab", { name: "Holdings" }));

    expect(await screen.findByRole("checkbox", { name: "Property on" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Property required" })).toBeChecked();
  });
});
