import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

let permissions: string[];

let group: Record<string, unknown>;

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_groups") return { items: [group] };
  if (name === "actor_list_group_populations") return { items: [] };
  if (name === "actor_get_group") return { item: group };
  if (name === "actor_get_group_population") return { group_id: "g1", population: 11195 };
  throw new Error(`${name}: unknown tool`);
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  group = { id: "g1", name: "Zöldhalom", node_type: "district", anchor_level_override: "lv1", join_mode: "open", hidden: false };
  openAgency("town");
  permissions = ["group.manage", "group.settings"];
  setWide(true);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

const open = async (title: string) => {
  if (title === "Households") group = { ...group, node_type: "household" };
  const path = items.find((item) => item.title === title)?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Zöldhalom/ }));
  return document.querySelector(".wf-main .wf-content") as HTMLElement;
};

describe.each([{ title: "Groups & Associations" }, { title: "Households" }])("the $title page is built like a resident", ({ title }) => {
  it("titles the page with the group's name and draws no band", async () => {
    const pane = within(await open(title));
    expect(await pane.findByRole("heading", { level: 1, name: "Zöldhalom" })).toBeInTheDocument();
    expect(document.querySelector(".wf-head")).toBeNull();
  });

  it("holds Name, Joining, Members and Hidden as rows of one Group detail card, the count only", async () => {
    const pane = within(await open(title));
    const card = within(await pane.findByRole("region", { name: "Group detail" }));
    for (const label of ["Name", "Joining", "Members", "Hidden"]) expect(card.getByText(label)).toBeInTheDocument();
    expect(card.getByText("11195 members")).toBeInTheDocument();
    expect(pane.queryAllByRole("button", { name: /Szabó|Kovács/ })).toHaveLength(0);
  });

  it("puts one Edit and a Hide in the card footer, each named, and no second Edit", async () => {
    const pane = within(await open(title));
    const card = within(await pane.findByRole("region", { name: "Group detail" }));
    expect(card.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(card.getByRole("button", { name: "Hide" })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Edit" }).closest("footer")).not.toBeNull();
  });

  it("opens one edit screen holding the name and the joining under a single Save", async () => {
    const pane = within(await open(title));
    await userEvent.click(await pane.findByRole("button", { name: "Edit" }));
    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Joining")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1));
  });
});
