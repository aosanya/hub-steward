import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const personName = "Sample Resident A";
const groupNames = ["Sample Group 1", "Sample Group 2", "Sample Group 3", "Sample Group 4"];

let memberships: string[];

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view", "member.edit", "group.manage", "application.file", "board.manage"] };
  if (name === "actor_list_actors") return { items: [{ id: "p1", display_name: personName, status: "active" }] };
  if (name === "actor_get_actor") return { id: "p1", display_name: personName, status: "active", attributes: { address: "Sample Lane 4" } };
  if (name === "actor_list_attribute_properties") return { items: [{ name: "address", label: "Address", range: "text" }] };
  if (name === "actor_list_groups_for_actor") return { items: memberships.map((group_id) => ({ group_id })) };
  if (name === "actor_list_groups") return { items: groupNames.map((groupName, index) => ({ id: `g${index + 1}`, name: groupName })) };
  return { items: [] };
};

beforeEach(() => {
  openAgency("town");
  memberships = [];
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openPerson = async (wide: boolean, path?: string) => {
  setWide(wide);
  const start = path ?? items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  if (!path && !wide) await userEvent.click(await screen.findByRole("button", { name: new RegExp(personName) }));
  await screen.findByRole("heading", { name: "Bills" });
  return document.querySelector(".mw-detail") as HTMLElement;
};

describe("the resident page is titled with the name and keeps its actions small", () => {
  it("makes the name the page title and draws no Name row", async () => {
    const page = await openPerson(false);
    expect(within(page).getByRole("heading", { level: 1, name: personName })).toBeTruthy();
    expect(within(page).queryByText("Name")).toBeNull();
  });

  it("offers Edit name and Edit attributes from one small Edit menu, not two full-width buttons", async () => {
    const page = await openPerson(false);
    expect(page.querySelectorAll(".btn").length).toBe(0);
    await userEvent.click(within(page).getByRole("button", { name: /^Edit/ }));
    expect(screen.getByRole("button", { name: "Edit name" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit attributes" })).toBeTruthy();
  });
});

describe("a section is one heading row over plain rows", () => {
  it("makes an empty section one row holding its words and its act, with no card", async () => {
    const page = await openPerson(false);
    const groups = page.querySelector("section.sec[aria-label='Groups']") as HTMLElement;
    const row = groups.querySelector(".row.empty-row") as HTMLElement;
    expect(row.textContent).toContain("Not in any group yet.");
    expect(within(row).getByRole("button", { name: "Add to a group" })).toBeTruthy();
    expect(page.querySelector(".card")).toBeNull();
  });

  it("shows a count, three rows and a See all row when a section has more", async () => {
    memberships = ["g1", "g2", "g3", "g4"];
    const page = await openPerson(false);
    const groups = page.querySelector("section.sec[aria-label='Groups']") as HTMLElement;
    await waitFor(() => expect(within(groups).getByText("Sample Group 1")).toBeTruthy());
    expect(within(groups).getByRole("heading", { name: /Groups/ }).textContent).toContain("4");
    expect(groups.querySelectorAll(".rows > .row:not(.more)").length).toBe(3);
    expect(within(groups).getByRole("button", { name: /See all 4/ })).toBeTruthy();
  });

  it("opens the section's own screen from the heading, with every row, the act, and Back to the resident", async () => {
    memberships = ["g1", "g2", "g3", "g4"];
    const page = await openPerson(false);
    const groups = page.querySelector("section.sec[aria-label='Groups']") as HTMLElement;
    await userEvent.click(within(groups).getByRole("button", { name: /Groups/ }));
    const screenHead = await screen.findByRole("heading", { level: 1, name: "Groups" });
    expect(screenHead).toBeTruthy();
    for (const groupName of groupNames) expect(await screen.findByText(groupName)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add to a group" })).toBeTruthy();
    expect(screen.getByText(new RegExp(`‹ ${personName}`))).toBeTruthy();
  });

  it("opens the same screen at the one route pattern for every section", async () => {
    for (const section of ["groups", "applications", "wishes", "bills", "holdings"]) {
      cleanup();
      setWide(false);
      await openPerson(false, `/menu/residents/people/p1/${section}`).catch(() => undefined);
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
      expect(document.body.textContent).toContain(personName);
    }
  });
});
