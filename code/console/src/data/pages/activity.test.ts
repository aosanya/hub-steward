import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { pageModule } from "../registry";
import { activityPage } from "./activity";

vi.mock("../../wakala/mcp");

const toolsCalled = () => vi.mocked(callTool).mock.calls.map((call) => call[1]);

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockResolvedValue({
    items: [
      { id: "a1", name: "Dispatcher", status: "enabled" },
      { id: "a2", name: "Matcher", status: "disabled" },
      { id: "a3", name: "Scribe" },
    ],
  } as never);
});

describe("the activity page", () => {
  it("is registered with its title, its one tool and two columns", () => {
    expect(pageModule("activity")).toBe(activityPage);
    expect(activityPage.spec.id).toBe("activity");
    expect(activityPage.spec.title).toBe("Activity");
    expect(activityPage.spec.tools).toEqual(["ai_list_roles"]);
    expect(activityPage.spec.columns).toEqual([
      { key: "name", label: "Agent" },
      { key: "state", label: "State" },
    ]);
    expect(activityPage.actions).toBeUndefined();
  });

  it("shows each agent's name and whether it is switched on", async () => {
    const rows = await activityPage.rows("h", {});
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: "a1", name: "Dispatcher", state: "Switched on" });
    expect(rows[1].state).toBe("Switched off");
    expect(rows[2].state).toBe("Switched off");
  });

  it("calls only the list of AI roles, for the hub asked about", async () => {
    await activityPage.rows("h", {});
    expect(toolsCalled()).toEqual(["ai_list_roles"]);
    expect(vi.mocked(callTool).mock.calls[0][0]).toBe("h");
  });

  it("passes the tool's error on", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("down"));
    await expect(activityPage.rows("h", {})).rejects.toThrow("down");
  });
});
