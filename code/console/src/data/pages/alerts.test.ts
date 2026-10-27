import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { pageModule } from "../registry";
import { alertsPage } from "./alerts";

vi.mock("../../wakala/mcp");

const calls = () => vi.mocked(callTool).mock.calls.map((call) => ({ tool: call[1], args: call[2] }));

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
    if (tool === "comm_chat_thread_list") {
      return { items: [{ id: "t1", label: "Chat" }, { id: "t2", label: "Network alerts" }, { label: "Network alerts" }] } as never;
    }
    if (tool === "comm_chat_message_list") {
      return {
        items: [
          { id: "m1", body: "Uplink down at Kisumu depot\nCheck the switch.", created_at: "2026-10-27T08:00:00Z" },
          { id: "m2", body: "Camera 3 offline", created_at: "2026-10-27T09:00:00Z" },
        ],
      } as never;
    }
    return {} as never;
  });
});

describe("the alerts page", () => {
  it("is registered with three columns, no primary button and no actions", () => {
    expect(pageModule("alerts")).toBe(alertsPage);
    expect(alertsPage.spec.id).toBe("alerts");
    expect(alertsPage.spec.title).toBe("Alerts");
    expect(alertsPage.spec.primary).toBe("");
    expect(alertsPage.spec.tools).toEqual(["comm_chat_thread_list", "comm_chat_message_list"]);
    expect(alertsPage.spec.columns.map((column) => column.key)).toEqual(["alert", "state", "raised"]);
    expect(alertsPage.spec.columns.map((column) => column.label)).toEqual(["Alert", "State", "Raised"]);
    expect(alertsPage.actions).toBeUndefined();
  });

  it("lists the alerts of the watcher's thread only, each as the first line of the message, open, with when it was raised", async () => {
    const rows = await alertsPage.rows("h1", { room: "r1" });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "m1", alert: "Uplink down at Kisumu depot", state: "Open", raised: "2026-10-27T08:00:00Z" });
    expect(rows[1]).toMatchObject({ id: "m2", alert: "Camera 3 offline" });
    expect(calls()).toEqual([
      { tool: "comm_chat_thread_list", args: { structure_id: "r1" } },
      { tool: "comm_chat_message_list", args: { structure_id: "r1", thread_id: "t2" } },
    ]);
  });

  it("keeps the whole message beside its first line", async () => {
    const rows = await alertsPage.rows("h1", { room: "r1" });
    expect(rows[0].message).toBe("Uplink down at Kisumu depot\nCheck the switch.");
    expect(rows[1].message).toBe("Camera 3 offline");
  });

  it("asks the room it is given, for the hub asked about", async () => {
    await alertsPage.rows("h1", { room: "other" });
    expect(vi.mocked(callTool).mock.calls[0][0]).toBe("h1");
    expect(calls()[0].args).toEqual({ structure_id: "other" });
  });

  it("lists the open alerts for the open state and none for the closed state", async () => {
    const open = await alertsPage.rows("h1", { room: "r1", state: "open" });
    const closed = await alertsPage.rows("h1", { room: "r1", state: "closed" });
    expect(open).toHaveLength(2);
    expect(closed).toHaveLength(0);
  });

  it("asks nothing and lists nothing for a state it does not know or when there is no room", async () => {
    expect(await alertsPage.rows("h1", { room: "r1", state: "bogus" })).toEqual([]);
    expect(await alertsPage.rows("h1", {})).toEqual([]);
    expect(await alertsPage.rows("h1", { state: "open" })).toEqual([]);
    expect(calls()).toEqual([]);
  });

  it("lists nothing for a thread whose messages do not come back as a list", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "comm_chat_thread_list") return { items: [{ id: "t2", label: "Network alerts" }] } as never;
      return [{ id: "m1" }] as never;
    });
    expect(await alertsPage.rows("h1", { room: "r1" })).toEqual([]);
  });

  it("passes the tool's error on", async () => {
    vi.mocked(callTool).mockRejectedValueOnce(new Error("down"));
    await expect(alertsPage.rows("h1", { room: "r1" })).rejects.toThrow("down");
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "comm_chat_thread_list") return { items: [{ id: "t2", label: "Network alerts" }] } as never;
      throw new Error("messages down");
    });
    await expect(alertsPage.rows("h1", { room: "r1" })).rejects.toThrow("messages down");
  });
});
