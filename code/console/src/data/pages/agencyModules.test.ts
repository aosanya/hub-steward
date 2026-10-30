import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { holdOf, loadModules, setModuleEnabled, type AgencyModule } from "./agencyModules";

vi.mock("../../wakala/mcp");

const call = vi.mocked(callTool);

const callsTo = (tool: string) => call.mock.calls.filter(([, name]) => name === tool).map(([, , args]) => args);

const listed = [
  { id: "m1", code: "comm", name: "Chat", description: "Talk", locked: false, enabled: true, explicit: true, needed_by_steps: false },
  { id: "m2", code: "forms", name: "", description: "", locked: false, enabled: true, explicit: false, needed_by_steps: true },
  { id: "", code: "ghost" },
];

const answers = (replies: Record<string, unknown> = {}) =>
  call.mockImplementation((async (_hub: string, tool: string) => {
    if (tool in replies) return replies[tool];
    if (tool === "agency_list_drafts") return { items: [{ id: "d1", status: "open" }] };
    return { items: [] };
  }) as typeof callTool);

beforeEach(() => call.mockReset());

describe("loading the agency's modules", () => {
  it("lists them in the working draft and keeps the switch, the lock and the step need of each", async () => {
    answers({ agency_list_modules: { items: listed } });

    const modules = await loadModules("h1");

    expect(callsTo("agency_list_modules")).toEqual([{ draft_id: "d1" }]);
    expect(modules).toEqual([
      { id: "m1", code: "comm", name: "Chat", description: "Talk", locked: false, enabled: true, explicit: true, neededBySteps: false },
      { id: "m2", code: "forms", name: "forms", description: "", locked: false, enabled: true, explicit: false, neededBySteps: true },
    ]);
  });

  it("lists them without a draft scope when no draft is open", async () => {
    answers({ agency_list_drafts: { items: [] }, agency_list_modules: { items: [] } });

    expect(await loadModules("h1")).toEqual([]);
    expect(callsTo("agency_list_modules")).toEqual([{}]);
  });
});

describe("switching a module", () => {
  it("writes the switch into the working draft", async () => {
    answers();

    await setModuleEnabled("h1", "m1", false);

    expect(callsTo("agency_set_module_enabled")).toEqual([{ draft_id: "d1", module_id: "m1", enabled: false }]);
  });

  it("starts a draft to write into when none is open", async () => {
    answers({ agency_list_drafts: { items: [] }, agency_create_draft: { id: "d9" } });

    await setModuleEnabled("h1", "m1", true);

    expect(callsTo("agency_set_module_enabled")).toEqual([{ draft_id: "d9", module_id: "m1", enabled: true }]);
  });

  it("lets the refusal through", async () => {
    call.mockImplementation((async (_hub: string, tool: string) => {
      if (tool === "agency_set_module_enabled") throw new Error("a locked module cannot be switched off");
      return { items: [{ id: "d1", status: "open" }] };
    }) as typeof callTool);

    await expect(setModuleEnabled("h1", "m1", false)).rejects.toThrow("a locked module cannot be switched off");
  });
});

describe("what holds a module on", () => {
  const base: AgencyModule = { id: "m", code: "c", name: "n", description: "", locked: false, enabled: true, explicit: true, neededBySteps: false };

  it("is the lock first, then a step that needs it, else nothing", () => {
    expect(holdOf({ ...base, locked: true, neededBySteps: true })).toBe("locked");
    expect(holdOf({ ...base, explicit: false, neededBySteps: true })).toBe("steps");
    expect(holdOf({ ...base, explicit: true, neededBySteps: true })).toBe("free");
    expect(holdOf(base)).toBe("free");
  });

  it("is another module that requires it when it reads on without its own switch or a step", () => {
    expect(holdOf({ ...base, explicit: false, enabled: true })).toBe("required");
    expect(holdOf({ ...base, explicit: false, enabled: false })).toBe("free");
    expect(holdOf({ ...base, explicit: false, enabled: true, neededBySteps: true })).toBe("steps");
    expect(holdOf({ ...base, explicit: false, enabled: true, locked: true })).toBe("locked");
  });
});
