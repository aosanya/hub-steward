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

beforeEach(() => {
  openAgency("town");
  permissions = ["service.edit"];
  entry = { id: "c1", slug: "market-stall", name: "Market Stall Permit", summary: "Trade on the square", kind: "permit", form_id: "f1", doc: "{\"kind\":\"permit\",\"form_id\":\"f1\"}" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => {
    const given = (args ?? {}) as Record<string, string>;
    if (name === "agency_get_my_roles") return { permissions };
    if (name === "forms_catalog_entry_list_public") return { items: [entry] };
    if (name === "forms_catalog_entry_read") return { item: entry };
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

const change = async (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
};

describe("editing a service catalogue entry", () => {
  it("saves a new kind and form and shows them", async () => {
    await openEntry();
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await change("Kind", "fee");
    await change("Form id", "f2");
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
    expect(screen.getByText("f2")).toBeTruthy();
  });

  it("shows the hub's words when the form is not a form of the agency", async () => {
    await openEntry();
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await change("Form id", "f999");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("form_id is not a form of this agency")).toBeTruthy();
    expect(entry.form_id).toBe("f1");
  });

  it("shows no Edit to a caller without service.edit", async () => {
    permissions = ["service.read"];
    await openEntry();

    await screen.findByText("permit");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
