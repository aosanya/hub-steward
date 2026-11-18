import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { placePaths } from "../properties/paths";
import { items, routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const personName = "Sample Resident A";
const groupNames = ["Sample Group 1", "Sample Group 2", "Sample Group 3", "Sample Group 4"];
const everyPermission = ["member.view", "member.edit", "group.manage", "application.file", "board.manage", "digitaltwin.manage"];

let memberships: string[];
let permissions: string[];

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }, { module: "digitaltwin" }] };
  if (name === "agency_get_my_roles") return { permissions };
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
  permissions = everyPermission;
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const openPerson = async () => {
  setWide(false);
  const start = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        {routes()}
        <Route path={placePaths.holdingNew.pattern} element={<p>holding form</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(personName) }));
  await screen.findByRole("heading", { name: "Bills" });
  await screen.findByText("No holdings yet.");
  return document.querySelector(".mw-detail") as HTMLElement;
};

const card = (page: HTMLElement, label: string) => page.querySelector(`section.sec[aria-label='${label}']`) as HTMLElement;

const footItems = (section: HTMLElement) => Array.from(section.querySelector("footer.sec-foot")?.children ?? []).map((child) => child.textContent);

const namedActs = [
  ["Groups", "Add to a group"],
  ["Applications", "Start an application"],
  ["Wishes and issues", "Raise on their behalf"],
  ["Holdings", "Add holding"],
  ["Personal detail", "Edit"],
];

describe("an act names its object and is the whole footer when the card has no See all", () => {
  it.each(namedActs)("%s carries %s alone in its footer", async (label, act) => {
    const page = await openPerson();
    expect(footItems(card(page, label))).toEqual([act]);
  });

  it("gives Bills and Activity no act", async () => {
    const page = await openPerson();
    expect(footItems(card(page, "Bills"))).toEqual([]);
    expect(footItems(card(page, "Activity"))).toEqual([]);
  });
});

describe("the act is in the footer, never in the header", () => {
  it("keeps every named act out of every card header, filled or empty", async () => {
    memberships = ["g1", "g2"];
    const page = await openPerson();
    await waitFor(() => expect(within(card(page, "Groups")).getByText("Sample Group 1")).toBeTruthy());
    for (const section of Array.from(page.querySelectorAll("section.sec")) as HTMLElement[]) {
      expect(within(section.querySelector(".sec-head") as HTMLElement).getAllByRole("button").length).toBeLessThanOrEqual(2);
      expect(within(section.querySelector(".sec-head") as HTMLElement).queryByRole("button", { name: /^(Add|Start|Raise|Edit)/ })).toBeNull();
    }
  });
});

describe("See all comes first on the left and the act second on the right", () => {
  it("lists See all with the count, then the act", async () => {
    memberships = ["g1", "g2", "g3", "g4"];
    const page = await openPerson();
    await waitFor(() => expect(within(card(page, "Groups")).getByText("Sample Group 1")).toBeTruthy());
    expect(footItems(card(page, "Groups"))).toEqual(["See all 4", "Add to a group"]);
  });

  it("styles the act accent and bold and See all in the neutral text colour", () => {
    const css = readFileSync("src/shared/ui/section.css", "utf8");
    expect(css).toMatch(/\.sec-act \{[^}]*color: var\(--accent\)/);
    expect(css).toMatch(/\.sec-act \{[^}]*font-weight: 700/);
    expect(css).toMatch(/\.sec-foot-item \{[^}]*color: var\(--ink\)/);
    expect(css).not.toMatch(/\.sec-foot-item \{[^}]*var\(--accent\)/);
  });

  it("marks the act and See all with different classes", async () => {
    memberships = ["g1", "g2", "g3", "g4"];
    const page = await openPerson();
    await waitFor(() => expect(within(card(page, "Groups")).getByText("Sample Group 1")).toBeTruthy());
    const foot = card(page, "Groups").querySelector("footer.sec-foot") as HTMLElement;
    expect(within(foot).getByRole("button", { name: "See all 4" }).classList.contains("sec-act")).toBe(false);
    expect(within(foot).getByRole("button", { name: "Add to a group" }).classList.contains("sec-act")).toBe(true);
    expect(within(card(page, "Personal detail")).getByRole("button", { name: "Edit" }).classList.contains("sec-act")).toBe(true);
  });
});

describe("an act shows only to a reader who holds its permission", () => {
  it("draws no act and no footer content when only member.view is held", async () => {
    permissions = ["member.view"];
    const page = await openPerson();
    for (const [label] of namedActs) expect(footItems(card(page, label))).toEqual([]);
    expect(within(page).queryByRole("button", { name: "Add holding" })).toBeNull();
  });

  it("shows only the acts whose permission is held", async () => {
    permissions = ["member.view", "digitaltwin.manage"];
    const page = await openPerson();
    expect(footItems(card(page, "Holdings"))).toEqual(["Add holding"]);
    expect(footItems(card(page, "Groups"))).toEqual([]);
    expect(footItems(card(page, "Personal detail"))).toEqual([]);
  });
});

describe("Add holding opens the existing holding form", () => {
  it("goes to the Add holding screen from the Holdings footer", async () => {
    const page = await openPerson();
    await userEvent.click(within(card(page, "Holdings")).getByRole("button", { name: "Add holding" }));
    expect(await screen.findByText("holding form")).toBeTruthy();
  });
});

describe("the section screen keeps the act as the whole footer", () => {
  it("draws the act and no See all on the Groups screen", async () => {
    memberships = ["g1", "g2", "g3", "g4"];
    setWide(false);
    render(
      <MemoryRouter initialEntries={[residentPaths.personSection.path({ id: "p1", section: "groups" })]}>
        <Routes>{routes()}</Routes>
      </MemoryRouter>,
    );
    await screen.findByText("Sample Group 4");
    const section = document.querySelector("section.sec") as HTMLElement;
    expect(footItems(section)).toEqual(["Add to a group"]);
  });
});
