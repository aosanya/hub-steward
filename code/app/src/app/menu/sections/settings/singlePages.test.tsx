import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

const section = { path: "/a/town/menu/settings", title: "Settings" };

let permissions: string[];

const entries = [
  { id: "e1", actor: "a1", action: "granted a role", subject: "a2", at: "2026-11-12T14:30:00Z" },
  { id: "e2", actor: "a1", action: "published a form", subject: "f1", at: "2026-11-11T10:15:00Z" },
  { id: "e3", actor: "a1", action: "added a row", subject: "", at: "2026-11-10T10:15:00Z" },
  { id: "e4", actor: "a1", action: "renamed the agency", subject: "Riverside Office", at: "2026-11-09T10:15:00Z" },
];

beforeEach(() => {
  permissions = ["permission.override"];
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    switch (name) {
      case "agency_get_my_roles":
        return { permissions };
      case "agency_get_agency":
        return { name: "Riverside Office" };
      case "instance_get_languages":
        return { studio_default: "en", content: ["en", "sw"], content_default: "en" };
      case "audit_list_entries":
        return { items: entries };
      case "actor_get_actors":
        return { items: [{ id: "a1", display_name: "Asha Otieno" }, { id: "a2", display_name: "Bela Nagy" }] };
      case "forms_form_read":
        return { id: given.form_id, title: "Market stall fee" };
      case "forms_catalog_setting_read":
        return null;
      default:
        return { items: [] };
    }
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openAt = (title: string) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: items.find((item) => item.title === title)!.path!(), state: { from: section } }]}>
      <Routes>
        {routes()}
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe("the Agency Profile page", () => {
  it("has the page title, and the name and the languages each in a card of their own", async () => {
    openAt("Agency Profile");

    expect(await screen.findByRole("heading", { level: 1, name: "Agency Profile" })).toBeInTheDocument();
    const name = await screen.findByRole("region", { name: "Name" });
    expect(within(name).getByText("Riverside Office")).toBeInTheDocument();
    const languages = screen.getByRole("region", { name: "Languages" });
    expect(within(languages).getByText("en, sw")).toBeInTheDocument();
  });

  it("puts Rename in the footer of the Name card and Change languages in the footer of the Languages card", async () => {
    openAt("Agency Profile");

    const name = await screen.findByRole("region", { name: "Name" });
    expect(within(name).getByRole("button", { name: "Rename" }).closest("footer")).not.toBeNull();
    const languages = screen.getByRole("region", { name: "Languages" });
    expect(within(languages).getByRole("button", { name: "Change languages" }).closest("footer")).not.toBeNull();
  });

  it("shows neither act to someone who is not the owner", async () => {
    permissions = [];
    openAt("Agency Profile");

    await screen.findByRole("region", { name: "Name" });
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change languages" })).toBeNull();
  });
});

describe("the Details of a record page", () => {
  it("is one card whose record is chosen by tabs, with the detail rows inside it", async () => {
    openAt("Details of a record");

    const card = await screen.findByRole("region", { name: "Details" });
    expect(within(card).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Businesses", "Informal traders", "Residents", "Holdings"]);
    expect(within(card).getByRole("tab", { name: "Businesses" })).toHaveAttribute("aria-selected", "true");
    expect(await within(card).findByRole("checkbox", { name: "Tax number on" })).toBeChecked();
  });

  it("puts Add detail and Save details in the footer of the card", async () => {
    openAt("Details of a record");

    const card = await screen.findByRole("region", { name: "Details" });
    await within(card).findByRole("checkbox", { name: "Tax number on" });
    expect(within(card).getByRole("button", { name: "Add detail" }).closest("footer")).not.toBeNull();
    expect(within(card).getByRole("button", { name: "Save details" }).closest("footer")).not.toBeNull();
  });

  it("switches to the details of another record when its tab is chosen", async () => {
    openAt("Details of a record");

    const card = await screen.findByRole("region", { name: "Details" });
    await userEvent.click(within(card).getByRole("tab", { name: "Residents" }));
    expect(await within(card).findByRole("checkbox", { name: "Phone on" })).toBeChecked();
    expect(within(card).getByRole("tab", { name: "Residents" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("the Audit Log page", () => {
  it("has the page title and a strip of tabs by kind of change with their counts", async () => {
    openAt("Audit Log");

    expect(await screen.findByRole("heading", { level: 1, name: "Audit Log" })).toBeInTheDocument();
    const strip = await screen.findByRole("tablist");
    expect(within(strip).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All4", "Groups1", "Forms1", "Rows1", "Other1"]);
  });

  it("keeps only the changes of the chosen kind when a tab is chosen", async () => {
    openAt("Audit Log");

    await userEvent.click(await screen.findByRole("tab", { name: /^Forms/ }));
    expect(screen.getByText(/published a form: Market stall fee/)).toBeInTheDocument();
    expect(screen.queryByText(/granted a role/)).toBeNull();
  });

  it("shows each change as a row with what happened and who did it and when, as the lighter line", async () => {
    openAt("Audit Log");

    const row = (await screen.findByText("granted a role: Bela Nagy")).closest(".row") as HTMLElement;
    expect(within(row).getByText(/^Asha Otieno · /)).toBeInTheDocument();
  });
});
