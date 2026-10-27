import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { pageModule } from "../registry";
import { operationsPage, overviewOf } from "./operations";

vi.mock("../../wakala/mcp");

const countOf = (tool: string) => vi.mocked(callTool).mock.calls.filter((call) => call[1] === tool).length;

const answer = (failOn = "") =>
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
    if (tool === failOn) throw new Error("down");
    if (tool === "digitaltwin_node_list") {
      return {
        items: [
          { id: "n1", name: "Lab router", kind: "Gateway", status: "online" },
          { id: "n2", name: "Lab switch", kind: "Switch", status: "fault" },
          { id: "n3", name: "Lab hub", kind: "Hub", status: "online" },
        ],
      } as never;
    }
    if (tool === "digitaltwin_observation_latest") return { observed_at: "09:10" } as never;
    if (tool === "ai_list_roles") {
      return {
        items: [
          { id: "r1", name: "Hub Steward", status: "enabled" },
          { id: "r2", name: "Scout", status: "disabled" },
        ],
      } as never;
    }
    if (tool === "comm_chat_thread_list") return { items: [{ id: "t1", label: "Network alerts" }] } as never;
    if (tool === "comm_chat_message_list") {
      return { items: [{ id: "m1", body: "Lab switch is offline\nmore", created_at: "09:12" }] } as never;
    }
    throw new Error("unexpected " + tool);
  });

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  answer();
});

describe("the operations page", () => {
  it("is registered with its title, its five tools and three columns", () => {
    expect(pageModule("operations")).toBe(operationsPage);
    expect(operationsPage.spec.id).toBe("operations");
    expect(operationsPage.spec.title).toBe("Operations");
    expect(operationsPage.spec.tools).toEqual([
      "digitaltwin_node_list",
      "digitaltwin_observation_latest",
      "ai_list_roles",
      "comm_chat_thread_list",
      "comm_chat_message_list",
    ]);
    expect(operationsPage.spec.columns.map((column) => column.label)).toEqual(["Area", "Detail", "State"]);
    expect(operationsPage.actions).toBeUndefined();
  });

  it("opens with three tiles counting the devices online, the AI roles switched on and the open alerts", async () => {
    const rows = await operationsPage.rows("h", { room: "room1" });
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.slice(0, 3).map((row) => [row.area, row.detail, row.kind, row.state])).toEqual([
      ["Devices online", "2 of 3", "tile", ""],
      ["AI roles switched on", "1 of 2", "tile", ""],
      ["Open alerts", "1", "tile", ""],
    ]);
    expect(rows[0].id).toBe("Devices online");
  });

  it("lists the faulty devices and then the open alerts under Needs attention", async () => {
    const rows = await operationsPage.rows("h", { room: "room1" });
    expect(rows).toHaveLength(5);
    expect(rows[3]).toMatchObject({ id: "n2", kind: "attention", group: "Needs attention", area: "Network", detail: "Lab switch", state: "Fault" });
    expect(rows[4]).toMatchObject({ id: "m1", kind: "attention", group: "Needs attention", area: "Alerts", detail: "Lab switch is offline", state: "Open" });
  });

  it("has no alerts and asks for none when the hub has no room", async () => {
    const rows = await operationsPage.rows("h", {});
    expect(rows[2].detail).toBe("0");
    expect(countOf("comm_chat_thread_list")).toBe(0);
    expect(rows).toHaveLength(4);
  });

  it("asks only for the open alerts of the room it is given", async () => {
    await operationsPage.rows("h", { room: "room1" });
    const threadCall = vi.mocked(callTool).mock.calls.find((call) => call[1] === "comm_chat_thread_list");
    expect(threadCall?.[2]).toEqual({ structure_id: "room1" });
  });

  it("passes a tool's error on", async () => {
    for (const tool of ["digitaltwin_node_list", "ai_list_roles", "comm_chat_thread_list"]) {
      vi.mocked(callTool).mockReset();
      answer(tool);
      await expect(operationsPage.rows("h", { room: "room1" })).rejects.toThrow("down");
    }
  });
});

describe("the overview model the page draws", () => {
  it("counts the devices online, the AI roles switched on and the open alerts for the three tiles", async () => {
    const overview = overviewOf(await operationsPage.rows("h", { room: "room1" }));
    expect(overview.devices).toEqual({ online: 2, total: 3 });
    expect(overview.roles).toEqual({ on: 1, total: 2 });
    expect(overview.alerts).toBe(1);
  });

  it("keeps the faulty devices and the open alerts as the rows that need attention, in order", async () => {
    const overview = overviewOf(await operationsPage.rows("h", { room: "room1" }));
    expect(overview.attention.map((row) => [row.area, row.detail, row.state])).toEqual([
      ["Network", "Lab switch", "Fault"],
      ["Alerts", "Lab switch is offline", "Open"],
    ]);
  });

  it("counts nothing for rows that hold no tiles", () => {
    expect(overviewOf([])).toEqual({ devices: { online: 0, total: 0 }, roles: { on: 0, total: 0 }, alerts: 0, attention: [] });
  });

  it("still shows the roles and the alerts when the digital twin is not mounted on the hub", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool.startsWith("digitaltwin_")) throw new Error(`${tool}: unknown tool "${tool}"`);
      if (tool === "ai_list_roles") return { items: [{ id: "r1", name: "Hub Steward", status: "enabled" }] } as never;
      if (tool === "comm_chat_thread_list") return { items: [] } as never;
      throw new Error("unexpected " + tool);
    });
    const overview = overviewOf(await operationsPage.rows("h", { room: "room1" }));
    expect(overview.devices).toEqual({ online: 0, total: 0 });
    expect(overview.roles).toEqual({ on: 1, total: 1 });
    expect(overview.alerts).toBe(0);
  });

  it("still fails for a device list that breaks for another reason", async () => {
    answer("digitaltwin_node_list");
    await expect(operationsPage.rows("h", { room: "room1" })).rejects.toThrow("down");
  });
});
