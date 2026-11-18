import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { residentPaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const personName = "Sample Resident A";
const groupNames = ["Sample Group 1", "Sample Group 2", "Sample Group 3", "Sample Group 4"];

let memberships: string[];

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view", "member.edit", "group.manage", "application.file", "board.manage"] };
  if (name === "actor_list_actors") return { items: [{ id: "p1", display_name: personName, status: "active" }] };
  if (name === "actor_get_actor") return { id: "p1", display_name: personName, status: "active", attributes: { address: "Sample Lane 4" } };
  if (name === "actor_list_attribute_properties") return { items: [{ name: "address", label: "Address", range: "text" }, { name: "phone", label: "Phone", range: "text" }, { name: "email", label: "Email", range: "text" }] };
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

const openPerson = async (wide: boolean) => {
  setWide(wide);
  const start = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  if (!wide) await userEvent.click(await screen.findByRole("button", { name: new RegExp(personName) }));
  await screen.findByRole("heading", { name: "Bills" });
  return document.querySelector(".mw-detail") as HTMLElement;
};

describe("the resident page is titled with the name and keeps its actions small", () => {
  it("makes the name the page title and the first row of the Personal detail card, with no Name card", async () => {
    const page = await openPerson(false);
    expect(within(page).getByRole("heading", { level: 1, name: personName })).toBeTruthy();
    expect(page.querySelector("section.sec[aria-label='Name']")).toBeNull();
    const details = page.querySelector("section.sec[aria-label='Personal detail']") as HTMLElement;
    expect(within(details).getByText("Name")).toBeTruthy();
    expect(within(details).getByText(personName)).toBeTruthy();
  });

  it("puts the resident's details in one Personal detail card with an Edit button in its footer, no Edit attributes, no heading action, no full-width buttons", async () => {
    const page = await openPerson(false);
    expect(page.querySelectorAll(".btn").length).toBe(0);
    const details = page.querySelector("section.sec[aria-label='Personal detail']") as HTMLElement;
    expect(within(details).getByText("Sample Lane 4")).toBeTruthy();
    expect(within(details.querySelector("footer.sec-foot") as HTMLElement).getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(within(details.querySelector(".sec-head") as HTMLElement).getAllByRole("button").length).toBe(1);
    expect(within(details).queryByRole("button", { name: "Edit attributes" })).toBeNull();
    expect(within(details).queryByRole("textbox")).toBeNull();
  });

  it("opens one edit screen from Edit holding Name, Phone, Email and the other details, and returns to the resident's page on Cancel", async () => {
    const page = await openPerson(false);
    const details = page.querySelector("section.sec[aria-label='Personal detail']") as HTMLElement;
    await userEvent.click(within(details).getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Edit details" })).toBeTruthy();
    expect((await screen.findByLabelText("Name")) as HTMLInputElement).toHaveProperty("value", personName);
    expect(await screen.findByLabelText("Phone")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe("Sample Lane 4");
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("heading", { level: 1, name: personName })).toBeTruthy();
  });

  it("reads the resident's name on Back from the edit screen and has no second edit route", async () => {
    setWide(false);
    render(
      <MemoryRouter initialEntries={[residentPaths.personEdit.path({ id: "p1" })]}>
        <Routes>{routes()}</Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("Name")).toBeTruthy();
    expect(screen.getByText(new RegExp(`‹ ${personName}`))).toBeTruthy();
    expect(residentPaths.personEdit.pattern).toMatch(/\/people\/:id\/edit$/);
  });

  it("saves the name and the other details together from the one screen and returns to the resident's page", async () => {
    const page = await openPerson(false);
    const details = page.querySelector("section.sec[aria-label='Personal detail']") as HTMLElement;
    await userEvent.click(within(details).getByRole("button", { name: "Edit" }));
    const name = (await screen.findByLabelText("Name")) as HTMLInputElement;
    await userEvent.clear(name);
    await userEvent.type(name, "Sample Resident B");
    const address = (await screen.findByLabelText("Address")) as HTMLInputElement;
    await userEvent.clear(address);
    await userEvent.type(address, "Sample Lane 9");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { level: 1, name: personName })).toBeTruthy();
    const sent = (tool: string) => vi.mocked(mcp.callTool).mock.calls.find((call) => call[1] === tool)?.[2];
    expect(sent("actor_set_actor_display_name")).toMatchObject({ actor_id: "p1", display_name: "Sample Resident B" });
    expect(sent("actor_set_actor_attributes")).toMatchObject({ actor_id: "p1", attributes: { address: "Sample Lane 9" } });
  });
});

describe("the wide pane titles the resident with the name alone", () => {
  it("draws no list title band above the resident", async () => {
    const page = await openPerson(true);
    expect(page.querySelector(".wf-head")).toBeNull();
    expect(within(page).getByRole("heading", { level: 1, name: personName })).toBeTruthy();
  });
});

describe("the section heading is the large text and rows are divided", () => {
  it("styles the heading larger than the row titles inside a square card with divided header, rows and footer", () => {
    const css = readFileSync("src/shared/ui/section.css", "utf8");
    expect(css).toMatch(/\.sec-title \{[^}]*font-size: 1rem/);
    expect(css).toMatch(/\.sec \{[^}]*border-radius: 0/);
    expect(css).toMatch(/\.sec-head \{[^}]*box-shadow:/);
    expect(css).toMatch(/\.sec \.row \.ttl \{[^}]*font-weight: 500/);
  });
});

describe("a section is one heading row over plain rows", () => {
  it("makes an empty section one row of words with its act in the card footer", async () => {
    const page = await openPerson(false);
    const groups = page.querySelector("section.sec[aria-label='Groups']") as HTMLElement;
    const row = groups.querySelector(".rows > .row.empty-row") as HTMLElement;
    expect(row.textContent).toContain("Not in any group yet.");
    const foot = groups.querySelector("footer.sec-foot") as HTMLElement;
    expect(within(foot).getByRole("button", { name: "Add to a group" })).toBeTruthy();
    expect(page.querySelector(".card")).toBeNull();
  });

  it("shows a count, three rows and a See all row when a section has more", async () => {
    memberships = ["g1", "g2", "g3", "g4"];
    const page = await openPerson(false);
    const groups = page.querySelector("section.sec[aria-label='Groups']") as HTMLElement;
    await waitFor(() => expect(within(groups).getByText("Sample Group 1")).toBeTruthy());
    expect(within(groups).getByRole("heading", { name: /Groups/ }).textContent).toContain("4");
    expect(groups.querySelectorAll(".rows > .row").length).toBe(3);
    expect(within(groups.querySelector("footer.sec-foot") as HTMLElement).getByRole("button", { name: /See all 4/ })).toBeTruthy();
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
    const words = { groups: "Groups", applications: "Applications", wishes: "Wishes and issues", bills: "Bills", holdings: "Holdings" };
    for (const [section, word] of Object.entries(words)) {
      cleanup();
      setWide(false);
      render(
        <MemoryRouter initialEntries={[residentPaths.personSection.path({ id: "p1", section })]}>
          <Routes>{routes()}</Routes>
        </MemoryRouter>,
      );
      expect(await screen.findByRole("heading", { level: 1, name: word })).toBeTruthy();
      expect(await screen.findByText(new RegExp(personName))).toBeTruthy();
    }
  });
});

describe("each section is a card with a chevron header that collapses it and a footer that holds the act", () => {
  it("gives every section header one chevron button, open by default, that names what it does", async () => {
    const page = await openPerson(false);
    const cards = Array.from(page.querySelectorAll("section.sec")) as HTMLElement[];
    expect(cards.length).toBeGreaterThan(1);
    for (const card of cards) {
      const toggle = within(card.querySelector(".sec-head") as HTMLElement).getByRole("button", { name: "Collapse" });
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(toggle.querySelector("svg[data-icon='chevron']")).toBeTruthy();
    }
  });

  it("hides the rows and the footer when the chevron is pressed and shows them again when it is pressed again", async () => {
    const page = await openPerson(false);
    const details = page.querySelector("section.sec[aria-label='Personal detail']") as HTMLElement;
    const head = details.querySelector(".sec-head") as HTMLElement;
    await userEvent.click(within(head).getByRole("button", { name: "Collapse" }));
    const toggle = within(head).getByRole("button", { name: "Expand" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(within(details).queryByText("Sample Lane 4")).toBeNull();
    expect(within(details).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(details).getByRole("heading", { name: /Personal detail/ })).toBeTruthy();
    await userEvent.click(toggle);
    expect(within(details).getByText("Sample Lane 4")).toBeTruthy();
    expect(within(details).getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("collapses one section without touching the others", async () => {
    const page = await openPerson(false);
    const details = page.querySelector("section.sec[aria-label='Personal detail']") as HTMLElement;
    const groups = page.querySelector("section.sec[aria-label='Groups']") as HTMLElement;
    await userEvent.click(within(details.querySelector(".sec-head") as HTMLElement).getByRole("button", { name: "Collapse" }));
    expect(within(groups.querySelector(".sec-head") as HTMLElement).getByRole("button", { name: "Collapse" }).getAttribute("aria-expanded")).toBe("true");
    expect(within(groups).getByText("Not in any group yet.")).toBeTruthy();
  });

  it("keeps the section screen's own card without a collapse button", async () => {
    setWide(false);
    render(
      <MemoryRouter initialEntries={[residentPaths.personSection.path({ id: "p1", section: "groups" })]}>
        <Routes>{routes()}</Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { level: 1, name: "Groups" });
    expect(screen.queryByRole("button", { name: "Collapse" })).toBeNull();
  });
});

describe("the card look is the Bulma card in the app's own tokens", () => {
  const css = () => readFileSync("src/shared/ui/section.css", "utf8");

  it("has square corners, a hairline and a soft outer shadow", () => {
    expect(css()).toMatch(/\.sec \{[^}]*border-radius: 0/);
    expect(css()).toMatch(/\.sec \{[^}]*box-shadow: [^;]*var\(--line\)/);
    expect(css()).not.toMatch(/border-radius: (?!0)/);
  });

  it("puts a small shadow under the header and a hairline above the footer", () => {
    expect(css()).toMatch(/\.sec-head \{[^}]*box-shadow:/);
    expect(css()).toMatch(/\.sec-foot \{[^}]*border-top: 1px solid/);
  });

  it("divides the footer items with vertical hairlines, each filling an equal share", () => {
    expect(css()).toMatch(/\.sec-foot > \* \{[^}]*flex: 1/);
    expect(css()).toMatch(/\.sec-foot > \* \+ \* \{[^}]*border-left: 1px solid/);
  });

  it("turns the chevron a quarter when the card is collapsed and sizes everything in rem", () => {
    expect(css()).toMatch(/\.sec-toggle\[aria-expanded="false"\] \.icon \{[^}]*rotate\(-90deg\)/);
    expect(css()).not.toMatch(/font-size: [\d.]+px/);
  });
});
