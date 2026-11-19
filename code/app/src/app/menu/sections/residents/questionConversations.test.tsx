import { vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { conversationRows } from "./PeopleScreens";

type Args = Record<string, unknown>;

const threads = [
  { id: "t1", label: "General", audience: "group", last_message_at: "2026-03-10T12:00:00Z" },
  { id: "t2", label: "Permit office hours", audience: "leads", requested_by: "p7", requested_by_name: "Sipos Hanna", last_message_at: "2026-03-12T12:00:00Z" },
  { id: "t3", label: "Opening times", audience: "leads", requested_by: "p8", requested_by_name: "", last_message_at: "2026-03-11T12:00:00Z" },
];

beforeEach(() => {
  openAgency("town");
  const answers: Record<string, (args: Args) => unknown> = {
    actor_list_groups: () => ({ items: [{ id: "g1", name: "Services Desk" }] }),
    comm_chat_thread_list: () => ({ items: threads }),
  };
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answers[name]((args ?? {}) as Args));
});

afterEach(() => {
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("Communications in a room that takes questions", () => {
  it("lists a question by the asker's name with the room and the subject beside it", async () => {
    const rows = await conversationRows();
    const asked = rows.find((row) => row.id === "t2");
    expect(asked?.name).toBe("Sipos Hanna");
    expect(asked?.line).toBe("Services Desk · Permit office hours");
  });

  it("reads Unnamed person for an asker with no name, never the account id", async () => {
    const rows = await conversationRows();
    const asked = rows.find((row) => row.id === "t3");
    expect(asked?.name).toBe("Unnamed person");
    expect(JSON.stringify(rows)).not.toContain("p8");
  });

  it("keeps the room's name for the open thread", async () => {
    const rows = await conversationRows();
    expect(rows.find((row) => row.id === "t1")?.name).toBe("Services Desk");
  });
});
