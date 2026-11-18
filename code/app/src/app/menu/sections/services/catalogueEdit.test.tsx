import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { ServiceCatalogueScreen } from "./ServicesScreens";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let entry: Record<string, string>;

const knownForms = ["f1", "f2"];

const formRows = [
  { form: { id: "f1", title: "Market stall application" } },
  { form: { id: "f2", title: "Fee payment form" } },
];

const kindsValue = JSON.stringify([
  { name: "permit", fields: [] },
  { name: "licence", fields: [] },
  { name: "fee", fields: [] },
]);

beforeEach(() => {
  openAgency("town");
  permissions = ["service.edit"];
  entry = { id: "c1", slug: "market-stall", name: "Market Stall Permit", summary: "Trade on the square", kind: "permit", form_id: "f1", doc: "{\"kind\":\"permit\",\"form_id\":\"f1\"}" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as Record<string, string>;
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "forms_catalog_entry_list_public") return { items: [entry] };
    if (name === "forms_catalog_entry_read") return { item: entry };
    if (name === "forms_catalog_setting_read") return given.key === "kinds" ? { key: "kinds", value: kindsValue } : null;
    if (name === "forms_form_list") return { rows: formRows };
    if (name === "forms_catalog_entry_upsert") {
      if (given.form_id && !knownForms.includes(given.form_id)) throw new mcp.McpError("forms_catalog_entry_upsert: form_id is not a form of this agency");
      entry = { ...entry, ...given };
      return entry;
    }
    throw new Error(`${name} is not a tool this screen may use`);
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openEntry = async () => {
  render(
    <MemoryRouter initialEntries={["/a/town/menu/services/catalogue"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/services/catalogue" element={<ServiceCatalogueScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByText("Market Stall Permit"));
};

describe("editing a service catalogue entry", () => {
  it("names its fields in plain words and shows the entry's own kind and form chosen", async () => {
    await openEntry();
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Summary")).toBeTruthy();
    expect(screen.queryByLabelText("Line")).toBeNull();
    expect(screen.queryByLabelText("Form id")).toBeNull();
    expect(screen.queryByText("Form id")).toBeNull();
    expect((await screen.findByRole("radio", { name: "permit" })) as HTMLInputElement).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "fee" })).toHaveProperty("checked", false);
    expect(screen.getByRole("radio", { name: "Market stall application" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "Fee payment form" })).toHaveProperty("checked", false);
  });

  it("shows the form by its title and never by its id", async () => {
    await openEntry();

    expect(await screen.findByText("Market stall application")).toBeTruthy();
    expect(screen.queryByText("f1")).toBeNull();
  });

  it("reads a form that no longer exists as words, not as its id", async () => {
    entry = { ...entry, form_id: "f9" };
    await openEntry();

    expect(await screen.findByText("A form that no longer exists")).toBeTruthy();
    expect(screen.queryByText("f9")).toBeNull();
  });

  it("saves a new kind and form chosen from the lists and shows them", async () => {
    await openEntry();
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.click(await screen.findByRole("radio", { name: "fee" }));
    await userEvent.click(screen.getByRole("radio", { name: "Fee payment form" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_upsert", {
        slug: "market-stall",
        name: "Market Stall Permit",
        summary: "Trade on the square",
        doc: "{\"kind\":\"permit\",\"form_id\":\"f1\"}",
        kind: "fee",
        form_id: "f2",
      }),
    );
    expect(await screen.findByText("fee")).toBeTruthy();
    expect(await screen.findByText("Fee payment form")).toBeTruthy();
    expect(screen.queryByText("f2")).toBeNull();
  });

  it("shows the hub's words when the hub refuses the form", async () => {
    knownForms.splice(0, knownForms.length, "f1");
    await openEntry();
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await userEvent.click(await screen.findByRole("radio", { name: "Fee payment form" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("form_id is not a form of this agency")).toBeTruthy();
    expect(entry.form_id).toBe("f1");
    knownForms.splice(0, knownForms.length, "f1", "f2");
  });

  it("shows no Edit to a caller without service.edit", async () => {
    permissions = ["service.read"];
    await openEntry();

    await screen.findByText("permit");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
