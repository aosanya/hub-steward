import { vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

let permissions: string[];

let roster: { actor_id: string; display_name: string }[];

const group = { id: "g1", name: "Zöldhalom", node_type: "district", anchor_level_override: "lv1", join_mode: "open", hidden: false };

const memberCalls: Record<string, unknown>[] = [];

const answer = async (name: string, args?: Record<string, unknown>) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_groups") return { items: [group] };
  if (name === "actor_list_group_populations") return { items: [] };
  if (name === "actor_get_group") return { item: group };
  if (name === "actor_get_group_population") return { group_id: "g1", population: roster.length };
  if (name === "actor_list_group_members") {
    memberCalls.push(args ?? {});
    const q = String(args?.q ?? "").toLowerCase();
    const kept = roster.filter((member) => member.display_name.toLowerCase().includes(q));
    const offset = Number(args?.offset ?? 0);
    const limit = Number(args?.limit ?? kept.length);
    return { items: kept.slice(offset, offset + limit), total: kept.length };
  }
  throw new Error(`${name}: unknown tool`);
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
};

const people = (count: number) => Array.from({ length: count }, (_, index) => ({ actor_id: `a${index + 1}`, display_name: `Resident ${String(index + 1).padStart(2, "0")}` }));

beforeEach(() => {
  roster = people(5);
  memberCalls.length = 0;
  openAgency("town");
  permissions = ["group.manage", "group.settings", "member.view"];
  setWide(true);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args as Record<string, unknown>));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

const open = async () => {
  const path = items.find((item) => item.title === "Groups & Associations")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Zöldhalom/ }));
  return within(document.querySelector(".wf-main .wf-content") as HTMLElement);
};

describe("the Members card on a group page", () => {
  it("lists the first three members by name as rows of a Members card", async () => {
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Members" }));
    expect(await card.findByText("Resident 01")).toBeInTheDocument();
    expect(card.getByText("Resident 03")).toBeInTheDocument();
    expect(card.queryByText("Resident 04")).toBeNull();
  });

  it("reads the members once for the card, never one read per member", async () => {
    const pane = await open();
    await pane.findByText("Resident 01");
    expect(memberCalls).toHaveLength(1);
    expect(memberCalls[0]).toMatchObject({ group_id: "g1" });
  });

  it("names the total in the footer, See all 5", async () => {
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Members" }));
    expect(await card.findByRole("button", { name: "See all 5" })).toBeInTheDocument();
  });

  it("takes the total from the reply when the card holds fewer rows than the group has", async () => {
    roster = people(45);
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Members" }));
    expect(await card.findByRole("button", { name: "See all 45" })).toBeInTheDocument();
  });

  it("opens the full list from See all and pages on with Show more, each page one read", async () => {
    roster = people(45);
    const pane = await open();
    await userEvent.click(await within(await pane.findByRole("region", { name: "Members" })).findByRole("button", { name: "See all 45" }));
    const list = within(await screen.findByRole("dialog", { name: "Members" }));
    expect(await list.findByText("Resident 20")).toBeInTheDocument();
    expect(list.queryByText("Resident 21")).toBeNull();
    const before = memberCalls.length;
    await userEvent.click(list.getByRole("button", { name: "Show more" }));
    expect(await list.findByText("Resident 40")).toBeInTheDocument();
    expect(memberCalls.length).toBe(before + 1);
    expect(memberCalls[memberCalls.length - 1]).toMatchObject({ offset: 20 });
  });

  it("filters the full list by the typed word, sent as q", async () => {
    const pane = await open();
    await userEvent.click(await within(await pane.findByRole("region", { name: "Members" })).findByRole("button", { name: "See all 5" }));
    const list = within(await screen.findByRole("dialog", { name: "Members" }));
    await userEvent.type(await list.findByRole("searchbox"), "Resident 04");
    await waitFor(() => expect(memberCalls[memberCalls.length - 1]).toMatchObject({ q: "Resident 04" }));
    expect(await list.findByText("Resident 04")).toBeInTheDocument();
    await waitFor(() => expect(list.queryByText("Resident 02")).toBeNull());
  });

  it("opens the resident from a member row", async () => {
    const pane = await open();
    await userEvent.click(await pane.findByRole("button", { name: /Resident 02/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Resident 02" }).catch(() => null)).not.toBeUndefined();
  });

  it("shows the standard empty row for a group with no members", async () => {
    roster = [];
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Members" }));
    expect(await card.findByText("No members yet.")).toBeInTheDocument();
    expect(card.queryByRole("button", { name: /See all/ })).toBeNull();
  });

  it("shows a neutral word, never the raw id, for a member with no display name", async () => {
    roster = [{ actor_id: "a-raw-id-77", display_name: "" }, ...people(1)];
    const pane = await open();
    const card = within(await pane.findByRole("region", { name: "Members" }));
    await card.findByText("Resident 01");
    expect(card.queryByText(/a-raw-id-77/)).toBeNull();
    expect(card.getByText("Unnamed person")).toBeInTheDocument();
  });

  it("is not drawn, and reads nothing, without member.view", async () => {
    permissions = ["group.manage", "group.settings"];
    const pane = await open();
    await pane.findByRole("region", { name: "Group detail" });
    expect(pane.queryByRole("region", { name: "Members" })).toBeNull();
    expect(memberCalls).toHaveLength(0);
  });
});
