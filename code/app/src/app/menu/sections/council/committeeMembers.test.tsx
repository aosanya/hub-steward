import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { CommitteePage, CommitteesScreen } from "./CommitteesScreen";
import { councilPaths } from "./paths";

type Row = Record<string, unknown>;

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let seats: Row[];
let kinds: Row[];
let refusal: string;

const people: Row[] = [
  { id: "a1", display_name: "Balogh Anna" },
  { id: "a2", display_name: "Varga József" },
  { id: "a3", display_name: "Takács Erzsébet" },
  { id: "a4", display_name: "Nagy Márton" },
  { id: "a5", display_name: "Nagy Zsófia" },
  { id: "a6", display_name: "Kovács Gergely" },
];

const seat = (id: string, actor: string, kind: string, group = "g1"): Row => ({ id, actor_id: actor, group_id: group, kind_id: kind, active: true });

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "actor_list_groups") return { items: [{ id: "g1", name: "Audit Committee", node_type: "Committee" }, { id: "g2", name: "Consultation Committee", node_type: "Committee" }] };
  if (name === "actor_list_group_leaders") return { items: given.group_id === "g1" ? [{ actor_id: "a1", display_name: "Balogh Anna" }] : [] };
  if (name === "actor_list_role_kinds") return { items: kinds };
  if (name === "actor_list_actors") return { items: people };
  if (name === "actor_list_role_assignments_for_group") return { items: seats.filter((row) => row.group_id === given.group_id && (given.active_only !== true || row.active === true)) };
  if (name === "actor_assign_group") return {};
  if (name === "actor_grant_role") {
    if (refusal) throw new mcp.McpError(refusal);
    seats = [...seats, seat("s-new", String(given.actor_id), String(given.kind_id), String(given.group_id))];
    return {};
  }
  if (name === "actor_revoke_role") {
    seats = seats.map((row) => (row.id === given.assignment_id ? { ...row, active: false, ended_at: "2026-11-18T10:00:00Z" } : row));
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["group.manage"];
  refusal = "";
  kinds = [
    { id: "k-chair", name: "Chair", leads_group: true },
    { id: "k-member", name: "Member", leads_group: false },
  ];
  seats = [seat("s1", "a1", "k-chair"), seat("s2", "a2", "k-member"), seat("s3", "a3", "k-member"), { ...seat("s4", "a6", "k-member"), active: false, ended_at: "2026-11-01T00:00:00Z" }];
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name).map(([, , args]) => args);

const open = async (committee: string) => {
  render(
    <MemoryRouter initialEntries={[councilPaths.committees.path()]}>
      <Routes>
        <Route path={councilPaths.committees.pattern} element={<CommitteesScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(committee) }));
  await waitFor(() => expect(document.querySelector(".mw-detail")).not.toBeNull());
  return within(document.querySelector(".mw-detail") as HTMLElement);
};

const membersHeading = (count: number) => new RegExp(`^Members\\s*${count}$`);

const rowOf = (pane: ReturnType<typeof within>, name: string) => pane.getByText(name, { selector: ".ttl" }).closest(".row") as HTMLElement;

describe("the members of an opened committee", () => {
  it("lists the chair first and the members after, each with the role of an active seat, and leaves out an ended seat", async () => {
    const pane = await open("Audit Committee");

    expect(await pane.findByRole("heading", { name: membersHeading(3) })).toBeInTheDocument();
    expect(within(rowOf(pane, "Balogh Anna")).getByText("Chair")).toBeInTheDocument();
    expect(within(rowOf(pane, "Varga József")).getByText("Member")).toBeInTheDocument();
    expect(within(rowOf(pane, "Takács Erzsébet")).getByText("Member")).toBeInTheDocument();
    expect(pane.queryByText("Kovács Gergely", { selector: ".ttl" })).toBeNull();
    expect(callsTo("actor_list_role_assignments_for_group")).toContainEqual({ group_id: "g1", active_only: true });
  });

  it("shows the card No members yet. with Add member inside it when the committee holds no active seat", async () => {
    const pane = await open("Consultation Committee");

    const words = await pane.findByText("No members yet.");
    expect(within(words.closest("section") as HTMLElement).getByRole("button", { name: "Add member" })).toBeInTheDocument();
  });

  it("adds a person found by name: registers them in the group, gives the member seat and the list follows", async () => {
    const pane = await open("Audit Committee");
    await pane.findByRole("heading", { name: membersHeading(3) });

    await userEvent.click(pane.getByRole("button", { name: "Add member" }));
    await userEvent.type(pane.getByRole("searchbox"), "Nagy");
    expect(pane.getByText("Nagy Zsófia", { selector: ".ttl" })).toBeInTheDocument();
    expect(pane.queryByText("Kovács Gergely", { selector: ".ttl" })).toBeNull();
    await userEvent.clear(pane.getByRole("searchbox"));
    await userEvent.type(pane.getByRole("searchbox"), "Varga");
    expect(pane.getAllByText("Varga József", { selector: ".ttl" })).toHaveLength(1);
    await userEvent.clear(pane.getByRole("searchbox"));
    await userEvent.type(pane.getByRole("searchbox"), "Nagy");
    await userEvent.click(pane.getByText("Nagy Márton", { selector: ".ttl" }));
    await userEvent.click(pane.getByRole("button", { name: "Add Nagy Márton" }));

    await waitFor(() => expect(callsTo("actor_grant_role")).toEqual([{ actor_id: "a4", group_id: "g1", kind_id: "k-member" }]));
    expect(callsTo("actor_assign_group")).toEqual([{ actor_id: "a4", group_id: "g1" }]);
    expect(await pane.findByRole("heading", { name: membersHeading(4) })).toBeInTheDocument();
    expect(within(rowOf(pane, "Nagy Márton")).getByText("Member")).toBeInTheDocument();
  });

  it("shows the hub's words and adds nobody when the hub refuses the seat", async () => {
    refusal = "actor_grant_role: the actor already holds that seat";
    const pane = await open("Audit Committee");
    await pane.findByRole("heading", { name: membersHeading(3) });

    await userEvent.click(pane.getByRole("button", { name: "Add member" }));
    await userEvent.type(pane.getByRole("searchbox"), "Nagy");
    await userEvent.click(pane.getByText("Nagy Márton", { selector: ".ttl" }));
    await userEvent.click(pane.getByRole("button", { name: "Add Nagy Márton" }));

    expect(await pane.findByText("the actor already holds that seat")).toBeInTheDocument();
    expect(pane.getByRole("heading", { name: membersHeading(3) })).toBeInTheDocument();
  });

  it("says so and grants nothing when the hub has no Member role kind", async () => {
    kinds = [{ id: "k-chair", name: "Chair", leads_group: true }];
    const pane = await open("Audit Committee");
    await pane.findByRole("heading", { name: membersHeading(3) });

    await userEvent.click(pane.getByRole("button", { name: "Add member" }));
    await userEvent.type(pane.getByRole("searchbox"), "Nagy");
    await userEvent.click(pane.getByText("Nagy Márton", { selector: ".ttl" }));
    await userEvent.click(pane.getByRole("button", { name: "Add Nagy Márton" }));

    expect(await pane.findByText("This hub has no Member seat to give.")).toBeInTheDocument();
    expect(callsTo("actor_grant_role")).toEqual([]);
  });

  it("draws no Remove button inside a member's row and ends each row with a chevron that opens the member", async () => {
    const pane = await open("Audit Committee");
    await pane.findByRole("heading", { name: membersHeading(3) });

    for (const name of ["Balogh Anna", "Varga József", "Takács Erzsébet"]) {
      const row = rowOf(pane, name);
      expect(within(row).queryByRole("button", { name: "Remove" })).toBeNull();
      expect(row.querySelector(".end")?.textContent).toBe("\u203a");
    }
  });

  it("opens a member as a page: the name as title, the role as the quiet line, a Member card with plain rows and Remove from committee as its named footer act", async () => {
    const pane = await open("Audit Committee");
    await pane.findByRole("heading", { name: membersHeading(3) });

    await userEvent.click(rowOf(pane, "Varga József"));

    expect(await pane.findByRole("heading", { level: 1, name: "Varga József" })).toBeInTheDocument();
    expect(pane.getByText("Member", { selector: ".quiet-line" })).toBeInTheDocument();
    const card = pane.getByRole("region", { name: "Member" });
    expect(within(card).getByText("Name", { selector: ".ttl" })).toBeInTheDocument();
    expect(within(card).getByText("Role", { selector: ".ttl" })).toBeInTheDocument();
    const foot = card.querySelector(".sec-foot") as HTMLElement;
    expect(within(foot).getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(within(foot).getByRole("button", { name: "Remove from committee" })).toBeInTheDocument();
    expect(foot.children).toHaveLength(2);
    expect(callsTo("actor_revoke_role")).toEqual([]);
  });

  it("removes a member from their page by ending their seat and returns to the committee with the list following", async () => {
    const pane = await open("Audit Committee");
    await pane.findByRole("heading", { name: membersHeading(3) });
    await userEvent.click(rowOf(pane, "Varga József"));

    await userEvent.click(await pane.findByRole("button", { name: "Remove from committee" }));

    await waitFor(() => expect(callsTo("actor_revoke_role")).toEqual([{ assignment_id: "s2" }]));
    expect(await pane.findByRole("heading", { name: membersHeading(2) })).toBeInTheDocument();
    expect(pane.queryByText("Varga József", { selector: ".ttl" })).toBeNull();
    expect(pane.getByRole("heading", { level: 1, name: "Audit Committee" })).toBeInTheDocument();
  });

  it("goes back to the committee from a member's page without changing anything", async () => {
    const pane = await open("Audit Committee");
    await pane.findByRole("heading", { name: membersHeading(3) });
    await userEvent.click(rowOf(pane, "Takács Erzsébet"));

    await userEvent.click(await pane.findByRole("button", { name: "Back" }));

    expect(await pane.findByRole("heading", { name: membersHeading(3) })).toBeInTheDocument();
    expect(callsTo("actor_revoke_role")).toEqual([]);
  });

  it("shows no Add member and no Remove to a caller without group.manage, and still lists and opens the members", async () => {
    permissions = ["member.view"];
    const pane = await open("Audit Committee");

    expect(await pane.findByRole("heading", { name: membersHeading(3) })).toBeInTheDocument();
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));
    expect(pane.queryByRole("button", { name: "Add member" })).toBeNull();
    expect(pane.queryByRole("button", { name: "Remove" })).toBeNull();

    await userEvent.click(rowOf(pane, "Varga József"));

    expect(await pane.findByRole("heading", { level: 1, name: "Varga József" })).toBeInTheDocument();
    expect(pane.queryByRole("button", { name: "Remove from committee" })).toBeNull();
    expect(pane.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("holds the chair in the committee detail card as the person's name only, with the chair's word kept on the quiet line", async () => {
    const pane = await open("Audit Committee");

    const card = await pane.findByRole("region", { name: "Committee detail" });
    const chairRow = within(card).getByText("Chair", { selector: ".ttl" }).closest(".row") as HTMLElement;
    expect(within(chairRow).getByText("Balogh Anna", { selector: ".meta" })).toBeInTheDocument();
    expect(within(chairRow).queryByText("Chair: Balogh Anna")).toBeNull();
    expect(pane.getByText("Chair: Balogh Anna", { selector: ".quiet-line" })).toBeInTheDocument();
  });
  it("forgets an opened member page when another committee is chosen, so Remove never acts on the wrong committee", async () => {
    const pane = await open("Audit Committee");
    await pane.findByRole("heading", { name: membersHeading(3) });
    await userEvent.click(rowOf(pane, "Varga József"));
    await pane.findByRole("button", { name: "Remove from committee" });

    await userEvent.click(screen.getByRole("button", { name: /Consultation Committee/ }));

    const next = within(document.querySelector(".mw-detail") as HTMLElement);
    expect(await next.findByRole("heading", { level: 1, name: "Consultation Committee" })).toBeInTheDocument();
    expect(next.queryByRole("button", { name: "Remove from committee" })).toBeNull();
    expect(next.queryByText("Varga József")).toBeNull();
    expect(callsTo("actor_revoke_role")).toEqual([]);
  });

  it("closes an open Add member form when another committee is chosen", async () => {
    const pane = await open("Audit Committee");
    await pane.findByRole("heading", { name: membersHeading(3) });
    await userEvent.click(pane.getByRole("button", { name: "Add member" }));
    await userEvent.type(pane.getByRole("searchbox"), "Nagy");

    await userEvent.click(screen.getByRole("button", { name: /Consultation Committee/ }));

    const next = within(document.querySelector(".mw-detail") as HTMLElement);
    expect(await next.findByText("No members yet.")).toBeInTheDocument();
    expect(next.queryByRole("searchbox")).toBeNull();
  });
  it("drops an opened member page the moment the page is given another committee, even before anything reloads", async () => {
    const audit = { id: "g1", name: "Audit Committee", chair: "Chair: Balogh Anna", chairNames: "Balogh Anna" };
    const consultation = { id: "g2", name: "Consultation Committee", chair: "", chairNames: "" };
    const draw = (committee: Row) => (
      <MemoryRouter>
        <CommitteePage committee={committee} onChanged={() => undefined} />
      </MemoryRouter>
    );
    const { rerender } = render(draw(audit));
    await userEvent.click(await screen.findByText("Varga József", { selector: ".ttl" }));
    await screen.findByRole("button", { name: "Remove from committee" });

    rerender(draw(consultation));

    expect(await screen.findByRole("heading", { level: 1, name: "Consultation Committee" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove from committee" })).toBeNull();
  });

  it("drops an open Add member form the moment the page is given another committee", async () => {
    const audit = { id: "g1", name: "Audit Committee", chair: "", chairNames: "" };
    const consultation = { id: "g2", name: "Consultation Committee", chair: "", chairNames: "" };
    const draw = (committee: Row) => (
      <MemoryRouter>
        <CommitteePage committee={committee} onChanged={() => undefined} />
      </MemoryRouter>
    );
    const { rerender } = render(draw(audit));
    await userEvent.click(await screen.findByRole("button", { name: "Add member" }));
    await userEvent.type(screen.getByRole("searchbox"), "Nagy");

    rerender(draw(consultation));

    expect(await screen.findByText("No members yet.")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
