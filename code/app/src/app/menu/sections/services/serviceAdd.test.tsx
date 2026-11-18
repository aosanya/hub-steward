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
let permissions: string[];
let landed = "";
let refusal = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const kindsValue = JSON.stringify([{ name: "permit", fields: [] }, { name: "licence", fields: [] }]);

beforeEach(() => {
  openAgency("town");
  permissions = ["service.edit"];
  refusal = "";
  landed = "";
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const given = (args ?? {}) as Record<string, string>;
    if (tool === "agency_get_my_roles") return { permissions };
    if (tool === "forms_catalog_entry_list_public") return { items: [{ id: "c1", slug: "market-stall", name: "Market Stall Permit", summary: "Trade on the square" }] };
    if (tool === "forms_catalog_setting_read") return given.key === "kinds" ? { key: "kinds", value: kindsValue } : null;
    if (tool === "forms_form_list") return { rows: [{ form: { id: "f1", title: "Market stall application" } }] };
    if (tool === "forms_catalog_entry_upsert") {
      if (refusal) throw new mcp.McpError(refusal);
      return { id: "c2", ...given };
    }
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

const upserts = () => called.mock.calls.filter(([, tool]) => tool === "forms_catalog_entry_upsert");

describe("the Service Catalogue list", () => {
  it("carries the full-width Add service button above Search for a holder of service.edit", async () => {
    show(servicesPaths.catalogue.path());
    const button = await screen.findByRole("button", { name: "Add service" });
    const search = await screen.findByLabelText("Search");
    expect(button.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no Add button without service.edit", async () => {
    permissions = [];
    show(servicesPaths.catalogue.path());
    await screen.findByLabelText("Search");
    await waitFor(() => expect(called.mock.calls.some(([, tool]) => tool === "agency_get_my_roles")).toBe(true));
    expect(screen.queryByRole("button", { name: "Add service" })).not.toBeInTheDocument();
  });

  it("opens the one Add screen and makes no call until Save", async () => {
    show(servicesPaths.catalogue.path());
    await userEvent.click(await screen.findByRole("button", { name: "Add service" }));
    await waitFor(() => expect(landed).toBe(servicesPaths.catalogueNew.path()));
    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(upserts()).toHaveLength(0);
  });
});

describe("the service Add screen", () => {
  it("saves with forms_catalog_entry_upsert, a slug from the name and the chosen kind and form, then returns to the list", async () => {
    show(servicesPaths.catalogueNew.path());
    await userEvent.type(await screen.findByLabelText("Name"), "Fence Permit");
    await userEvent.type(screen.getByLabelText("Summary"), "Build a fence");
    await userEvent.click(await screen.findByLabelText("licence"));
    await userEvent.click(await screen.findByLabelText("Market stall application"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(upserts()).toHaveLength(1));
    expect(upserts()[0][2]).toMatchObject({ slug: "fence-permit", name: "Fence Permit", summary: "Build a fence", kind: "licence", form_id: "f1", doc: JSON.stringify({ kind: "licence", form_id: "f1" }) });
    await waitFor(() => expect(landed).toBe(servicesPaths.catalogue.path()));
  });

  it("turns a Hungarian name into a plain slug", async () => {
    show(servicesPaths.catalogueNew.path());
    await userEvent.type(await screen.findByLabelText("Name"), "Árvíz Segély");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(upserts()).toHaveLength(1));
    expect(upserts()[0][2]).toMatchObject({ slug: "arviz-segely", doc: "{}" });
  });

  it("says the refusal in words and stays on the screen", async () => {
    refusal = "tool error: that slug is taken";
    show(servicesPaths.catalogueNew.path());
    await userEvent.type(await screen.findByLabelText("Name"), "Fence Permit");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/slug is taken/)).toBeInTheDocument();
    expect(landed).toBe(servicesPaths.catalogueNew.path());
  });

  it("tells a caller without service.edit that they may not add", async () => {
    permissions = [];
    show(servicesPaths.catalogueNew.path());
    expect(await screen.findByText("You may not add this.")).toBeInTheDocument();
  });
});
