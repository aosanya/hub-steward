import { vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { dayWords } from "../../../../shared/ui/days";
import { conversationRows, registrationRows } from "./PeopleScreens";

type Args = Record<string, unknown>;

const groups = [{ id: "g1" }, { id: "g2" }, { id: "g3" }, { id: "g4" }];
const people = [
  { id: "p3", display_name: "Eli Marsh" },
  { id: "p4", display_name: "Nia Brandt" },
];
const joinRequests = [
  { id: "r1", actor_id: "p3", actor_name: "", state: "pending", requested_at: "2026-03-04T12:00:00Z" },
  { id: "r2", actor_id: "p4", actor_name: "Nia B.", state: "pending", requested_at: "2026-03-09T12:00:00Z" },
];
const threads = [
  { id: "t1", label: "Garden Helpers", last_message_at: "2026-03-10T12:00:00Z" },
  { id: "t2", label: "Street Party Plans", last_message_at: "2026-03-12T12:00:00Z" },
];

beforeEach(() => {
  openAgency("town");
  const answers: Record<string, (args: Args) => unknown> = {
    actor_list_groups: () => ({ items: groups }),
    actor_list_actors: () => ({ items: people }),
    actor_list_join_requests_for_group: (args) => ({ items: args.group_id === "g1" ? joinRequests : [] }),
    comm_chat_thread_list: (args) => ({ items: args.structure_id === "g3" ? threads : [] }),
  };
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answers[name]((args ?? {}) as Args));
});

afterEach(() => {
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the rows that open a record in its own group", () => {
  it("gives each registration its group id and name and the asking actor's id", async () => {
    expect(await registrationRows()).toEqual([
      { id: "r1", name: "Eli Marsh", asked: dayWords("2026-03-04T12:00:00Z"), group_id: "g1", group_name: "", actor_id: "p3" },
      { id: "r2", name: "Nia B.", asked: dayWords("2026-03-09T12:00:00Z"), group_id: "g1", group_name: "", actor_id: "p4" },
    ]);
  });

  it("gives each conversation the id of the group it belongs to", async () => {
    expect(await conversationRows()).toEqual([
      { id: "t2", name: "", label: "Street Party Plans", line: "Street Party Plans", at: "2026-03-12T12:00:00Z", last: dayWords("2026-03-12T12:00:00Z"), group_id: "g3" },
      { id: "t1", name: "", label: "Garden Helpers", line: "Garden Helpers", at: "2026-03-10T12:00:00Z", last: dayWords("2026-03-10T12:00:00Z"), group_id: "g3" },
    ]);
  });
});
