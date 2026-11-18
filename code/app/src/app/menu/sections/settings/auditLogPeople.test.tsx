import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { dateTimeWords } from "../../../../shared/ui/days";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

const section = { path: "/a/town/menu/settings", title: "Settings" };

const unreadableId = "9f3c2a10-aaaa-bbbb-cccc-000000000000";
const nameless = "5e77d0c4-1111-2222-3333-000000000000";

const people = [
  { id: "p1", display_name: "Asha Otieno" },
  { id: "p2", display_name: "Bela Nagy" },
  { id: nameless, display_name: "", email: "", phone: "" },
];

const registeredAt = "2026-11-12T14:30:00Z";
const consentAt = "2026-11-11T10:15:00Z";
const strangerAt = "2026-11-10T08:00:00Z";
const namelessAt = "2026-11-09T08:00:00Z";

const entries = [
  { id: "e1", actor: "p1", action: "registered in a group", subject: "p2", at: registeredAt },
  { id: "e2", actor: "p1", action: "recorded consent given on paper, text v1", subject: "p2", at: consentAt },
  { id: "e3", actor: unreadableId, action: "registered in a group", subject: unreadableId, at: strangerAt },
  { id: "e4", actor: nameless, action: "granted a role", subject: nameless, at: namelessAt },
];

const idsIn = (args: Record<string, unknown>) => [args.id].flat().filter((id): id is string => typeof id === "string");

let readsRefused = false;

const reply = (name: string, args: Record<string, unknown>): unknown => {
  switch (name) {
    case "audit_list_entries":
      return { items: entries };
    case "actor_get_actors":
      if (readsRefused) throw new mcp.McpError("not allowed");
      return { items: people.filter((person) => idsIn(args).includes(person.id)) };
    default:
      throw new Error(`unexpected tool ${name}`);
  }
};

beforeEach(() => {
  readsRefused = false;
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => reply(name, (args ?? {}) as Record<string, unknown>));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openAuditLog = () => {
  const item = items.find((candidate) => candidate.title === "Audit Log")!;
  return render(
    <MemoryRouter initialEntries={[{ pathname: item.path!(), state: { from: section } }]}>
      <Routes>
        {routes()}
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
};

const called = (name: string) => vi.mocked(mcp.callTool).mock.calls.filter((call) => call[1] === name);

const rowOf = (node: HTMLElement) => node.closest("button, .row") as HTMLElement;

const idPattern = /[0-9a-f]{8}/;

describe("the Audit Log naming the people an entry is about", () => {
  it("reads a group registration as the registered person's name, done by the actor's name", async () => {
    openAuditLog();

    const row = rowOf((await screen.findAllByText(/registered in a group: Bela Nagy/))[0]);
    expect(within(row).getByText(`Asha Otieno · ${dateTimeWords(registeredAt)}`)).toBeInTheDocument();
  });

  it("reads a paper consent as the person's name after the words about the text", async () => {
    openAuditLog();

    const row = rowOf(await screen.findByText(/recorded consent given on paper, text v1: Bela Nagy/));
    expect(within(row).getByText(`Asha Otieno · ${dateTimeWords(consentAt)}`)).toBeInTheDocument();
  });

  it("says Someone for an actor and a person nothing can name, and prints no id", async () => {
    openAuditLog();

    const row = rowOf((await screen.findAllByText(/registered in a group: Someone/))[0]);
    expect(within(row).getByText(`Someone · ${dateTimeWords(strangerAt)}`)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(unreadableId.slice(0, 8)))).toBeNull();
  });

  it("says Someone for a person who is known but has no name, email or phone", async () => {
    openAuditLog();

    const row = rowOf(await screen.findByText("granted a role: Someone"));
    expect(within(row).getByText(`Someone · ${dateTimeWords(namelessAt)}`)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(nameless.slice(0, 8)))).toBeNull();
  });

  it("keeps the page working and shows no id when the read of people is refused", async () => {
    readsRefused = true;
    openAuditLog();

    await screen.findAllByText(/registered in a group: Someone/);
    expect(screen.getAllByText(/Someone · /)).toHaveLength(entries.length);
    expect(document.body.textContent).not.toMatch(idPattern);
  });

  it("asks for every distinct person, whether actor or subject, in one call", async () => {
    openAuditLog();

    await screen.findAllByText(/registered in a group/);
    expect(called("actor_get_actors")).toHaveLength(1);
    expect(idsIn(called("actor_get_actors")[0][2] as Record<string, unknown>).sort()).toEqual(["p1", "p2", unreadableId, nameless].sort());
  });
});
