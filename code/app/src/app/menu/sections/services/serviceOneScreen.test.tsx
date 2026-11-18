import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { servicesPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;
let landed = "";

const Where = () => {
  const location = useLocation();
  landed = location.pathname + location.search;
  return null;
};

const entry = { id: "c1", slug: "market-stall", name: "Market Stall Permit", summary: "Trade on the square", kind: "permit", form_id: "f1", doc: "{\"kind\":\"permit\",\"form_id\":\"f1\"}" };

beforeEach(() => {
  openAgency("town");
  landed = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool) => {
    if (tool === "agency_get_my_roles") return { permissions: ["service.edit"] };
    if (tool === "forms_catalog_entry_read") return { item: entry };
    if (tool === "forms_catalog_entry_list_public") return { items: [entry] };
    if (tool === "forms_catalog_setting_read") return { key: "kinds", value: JSON.stringify([{ name: "permit", fields: [] }, { name: "fee", fields: [] }]) };
    if (tool === "forms_form_list") return { rows: [{ form: { id: "f1", title: "Market stall application" } }] };
    if (tool === "forms_catalog_entry_upsert") return entry;
    return { items: [] };
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

describe("the service screen", () => {
  it("is the same screen for Add and for Edit: the Edit route shows the entry's own words and Save upserts it by slug", async () => {
    show(servicesPaths.catalogueEdit.path({ slug: "market-stall" }));

    expect(await screen.findByText("Edit service")).toBeTruthy();
    const name = await screen.findByLabelText("Name");
    expect((name as HTMLInputElement).value).toBe("Market Stall Permit");
    expect(screen.queryByLabelText("Form id")).toBeNull();
    await userEvent.click(await screen.findByRole("radio", { name: "fee" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(called).toHaveBeenCalledWith("", "forms_catalog_entry_upsert", {
        slug: "market-stall",
        name: "Market Stall Permit",
        summary: "Trade on the square",
        doc: "{\"kind\":\"permit\",\"form_id\":\"f1\"}",
        kind: "fee",
        form_id: "f1",
      }),
    );
    await waitFor(() => expect(landed).toBe(servicesPaths.catalogue.path({ item: "market-stall" })));
  });

  it("opens the Edit route from the Edit act on the entry's detail", async () => {
    show(servicesPaths.catalogue.path());
    await userEvent.click(await screen.findByText("Market Stall Permit"));
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

    await waitFor(() => expect(landed).toBe(servicesPaths.catalogueEdit.path({ slug: "market-stall" })));
  });
});
