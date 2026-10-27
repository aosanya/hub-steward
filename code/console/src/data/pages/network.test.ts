import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { pageModule } from "../registry";
import { networkPage } from "./network";

vi.mock("../../wakala/mcp");

const calls = () => vi.mocked(callTool).mock.calls.map((call) => ({ tool: call[1], args: call[2] }));

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (_hubId, tool, args) => {
    if (tool === "digitaltwin_node_list") {
      return {
        items: [
          { id: "n1", name: "Lab router", kind: "Gateway", status: "online" },
          { id: "n2", name: "Lab switch", kind: "Switch", status: "fault" },
        ],
      } as never;
    }
    if (tool === "digitaltwin_observation_latest") {
      if (args?.node_id === "n2") throw new Error("none");
      return { observed_at: "09:10" } as never;
    }
    if (tool === "digitaltwin_link_list") {
      return {
        items: [
          { from_node_id: "n1", to_node_id: "t1" },
          { from_node_id: "t9", to_node_id: "n1" },
          { from_node_id: "n1", to_node_id: "t2" },
          { from_node_id: "n1", to_node_id: "" },
        ],
      } as never;
    }
    if (tool === "digitaltwin_node_read") {
      if (args?.node_id === "t1") return { id: "t1", name: "Terminal 1", kind: "Wired", status: "offline" } as never;
      return { id: "t2", name: "Terminal 2", kind: "Wired", status: "online" } as never;
    }
    throw new Error("unexpected " + tool);
  });
});

describe("the network page", () => {
  it("is registered with its title, its four tools and four columns", () => {
    expect(pageModule("network")).toBe(networkPage);
    expect(networkPage.spec.id).toBe("network");
    expect(networkPage.spec.title).toBe("Network");
    expect(networkPage.spec.tools).toHaveLength(4);
    expect(networkPage.spec.columns.map((column) => column.key)).toEqual(["name", "type", "state", "last_seen"]);
    expect(networkPage.spec.columns.map((column) => column.label)).toEqual(["Device", "Type", "State", "Last seen"]);
    expect(networkPage.actions).toBeUndefined();
  });

  it("lists each device with its type, its state with a capital and when it was last seen", async () => {
    const rows = await networkPage.rows("h", {});
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "n1", name: "Lab router", type: "Gateway", state: "Online", last_seen: "09:10" });
  });

  it("leaves last seen empty for a device whose latest observation cannot be read", async () => {
    const rows = await networkPage.rows("h", {});
    expect(rows[1]).toMatchObject({ state: "Fault", last_seen: "" });
  });

  it("asks for the latest observation of each device by its id", async () => {
    await networkPage.rows("h", {});
    expect(calls()).toEqual([
      { tool: "digitaltwin_node_list", args: undefined },
      { tool: "digitaltwin_observation_latest", args: { node_id: "n1" } },
      { tool: "digitaltwin_observation_latest", args: { node_id: "n2" } },
    ]);
  });

  it("shows only the terminals behind the device it is asked about", async () => {
    const rows = await networkPage.rows("h", { device: "n1" });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "t1", name: "Terminal 1", state: "Offline" });
    expect(rows[1]).toMatchObject({ name: "Terminal 2", state: "Online" });
    expect(calls()[0]).toEqual({ tool: "digitaltwin_link_list", args: { node_id: "n1" } });
    expect(calls().slice(1)).toEqual([
      { tool: "digitaltwin_node_read", args: { node_id: "t1" } },
      { tool: "digitaltwin_node_read", args: { node_id: "t2" } },
    ]);
  });

  it("passes the tool's error on for the device list and for the terminals", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("down"));
    await expect(networkPage.rows("h", {})).rejects.toThrow("down");
    await expect(networkPage.rows("h", { device: "n1" })).rejects.toThrow("down");
  });

  it("fails when a terminal cannot be read", async () => {
    vi.mocked(callTool).mockImplementation(async (_hubId, tool) => {
      if (tool === "digitaltwin_link_list") return { items: [{ from_node_id: "n1", to_node_id: "t1" }] } as never;
      throw new Error("gone");
    });
    await expect(networkPage.rows("h", { device: "n1" })).rejects.toThrow("gone");
  });

  it("shows no devices and no terminals when the digital twin is not mounted on the hub", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error('digitaltwin_node_list: unknown tool "digitaltwin_node_list"'));
    await expect(networkPage.rows("h", {})).resolves.toEqual([]);
    await expect(networkPage.rows("h", { device: "n1" })).resolves.toEqual([]);
  });
});
