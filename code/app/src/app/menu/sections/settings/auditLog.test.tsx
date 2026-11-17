import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { dateTimeWords } from "../../../../shared/ui/days";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

const section = { path: "/a/town/menu/settings", title: "Settings" };

const strangerActorId = "9f3c2a10-aaaa-bbbb-cccc-000000000000";
const strangerFormId = "7d41e8b2-1111-2222-3333-000000000000";

const actors = [
  { id: "a1", code: "AO-1", display_name: "Asha Otieno", first_name: "Asha", last_name: "Otieno" },
  { id: "a2", code: "BN-2", display_name: "Bela Nagy", first_name: "Bela", last_name: "Nagy" },
];

const forms: Record<string, unknown> = { f1: { id: "f1", title: "Market stall fee" } };

const grantedAt = "2026-11-12T14:30:00Z";
const publishedAt = "2026-11-11T10:15:00Z";
const strangerAt = "2026-11-10T08:00:00Z";

const entries = [
  { id: "e1", instance_id: "town", actor: "a1", action: "granted a role", subject: "a2", at: grantedAt },
  { id: "e2", instance_id: "town", actor: "a1", action: "published a form", subject: "f1", at: publishedAt },
  { id: "e3", instance_id: "town", actor: strangerActorId, action: "published a form", subject: strangerFormId, at: strangerAt },
];

const idsIn = (args: Record<string, unknown>) => [args.id].flat().filter((id): id is string => typeof id === "string");

const reply = (name: string, args: Record<string, unknown>): unknown => {
  switch (name) {
    case "audit_list_entries":
      return { items: entries };
    case "actor_get_actors":
      return { items: actors.filter((actor) => idsIn(args).includes(actor.id)) };
    case "forms_form_read": {
      const form = forms[args.form_id as string];
      if (form === undefined) throw new mcp.McpError("form not found");
      return form;
    }
    default:
      throw new Error(`unexpected tool ${name}`);
  }
};

beforeEach(() => {
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

const rowOfAction = async (action: RegExp) => (await screen.findAllByText(action))[0].closest("button, .row") as HTMLElement;

const shownRows = async () => {
  await screen.findByText(/granted a role/);
  return [await rowOfAction(/granted a role/), ...(await screen.findAllByText(/published a form/)).map((node) => node.closest("button, .row") as HTMLElement)];
};

describe("the Audit Log screen showing names instead of ids", () => {
  it("reads a granted role as the receiver's name, done by the actor's name", async () => {
    openAuditLog();

    const row = await rowOfAction(/granted a role/);
    expect(within(row).getByText("granted a role: Bela Nagy")).toBeInTheDocument();
    expect(within(row).getByText(`Asha Otieno · ${dateTimeWords(grantedAt)}`)).toBeInTheDocument();
  });

  it("reads a published form as the form's title, done by the actor's name", async () => {
    openAuditLog();

    await screen.findByText(/granted a role/);
    const row = screen.getAllByText(/published a form/)[0].closest("button, .row") as HTMLElement;
    expect(within(row).getByText("published a form: Market stall fee")).toBeInTheDocument();
    expect(within(row).getByText(`Asha Otieno · ${dateTimeWords(publishedAt)}`)).toBeInTheDocument();
  });

  it("falls back to the first eight characters of an id nothing can name", async () => {
    openAuditLog();

    await screen.findByText(/granted a role/);
    const row = screen.getAllByText(/published a form/)[1].closest("button, .row") as HTMLElement;
    expect(within(row).getByText("published a form: 7d41e8b2")).toBeInTheDocument();
    expect(within(row).getByText(`9f3c2a10 · ${dateTimeWords(strangerAt)}`)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(strangerActorId))).toBeNull();
    expect(screen.queryByText(new RegExp(strangerFormId))).toBeNull();
  });

  it("never prints the raw id of an actor or form it could name", async () => {
    openAuditLog();

    const rows = await shownRows();
    for (const row of rows) for (const id of ["a1", "a2", "f1"]) expect(row.textContent).not.toMatch(new RegExp(`\\b${id}\\b`));
  });

  it("asks for all distinct actors in one call and for each distinct form once", async () => {
    openAuditLog();

    await screen.findByText(/granted a role/);
    expect(called("actor_get_actors")).toHaveLength(1);
    expect([...idsIn(called("actor_get_actors")[0][2] as Record<string, unknown>)].sort()).toEqual(["a1", "a2", strangerActorId].sort());
    expect(called("forms_form_read").map((call) => (call[2] as Record<string, unknown>).form_id).sort()).toEqual(["f1", strangerFormId].sort());
  });
});
