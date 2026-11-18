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

    await user.click(await screen.findByRole("radio", { name: "Informal traders" }));
    await user.click(await screen.findByRole("checkbox", { name: "Usual days on" }));
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(stored).toHaveProperty("register_details:RC-2"));
    expect(stored).not.toHaveProperty("register_details:RC-1");
  });
});
