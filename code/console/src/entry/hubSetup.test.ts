import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentPermission } from "../data/pages/agents";
import { McpError, callTool } from "../wakala/mcp";
import { importHub, listServices } from "../wakala/rest";
import { SetupFailure, agentRoleName, serviceName, setUpHub } from "./hubSetup";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));
vi.mock("../data/pages/agents", async (importOriginal) => ({ ...(await importOriginal<object>()), agentPermission: "role.is-an-agent" }));
vi.mock("../wakala/rest", async (importOriginal) => ({ ...(await importOriginal<object>()), importHub: vi.fn(), listServices: vi.fn() }));

const callToolMock = vi.mocked(callTool);
const importHubMock = vi.mocked(importHub);
const listServicesMock = vi.mocked(listServices);

const reply = (status: number, data: unknown) => ({ ok: status >= 200 && status < 300, status, data }) as never;

type Tools = Record<string, unknown>;

const stubTools = (tools: Tools = {}) => {
  const answers: Tools = {
    agency_list_drafts: [{ id: "d1", description: "Imported from file" }],
    agency_list_roles: [{ id: "r1", name: agentRoleName, permissions: [agentPermission] }],
    agency_grant_service: {},
    actor_create_group: { id: "g" },
    actor_set_group_join_mode: {},
    ...tools,
  };
  callToolMock.mockImplementation(async (_hub, tool) => {
    const answer = answers[tool];
    if (answer instanceof Error) throw answer;
    return answer as never;
  });
};

const failureOf = async (work: Promise<unknown>) => {
  try {
    await work;
  } catch (error) {
    return error as SetupFailure;
  }
  throw new Error("setup did not fail");
};

const farmRooms = ["Managers' room", "Farmers' room", "Suppliers' room"];

const roomed = { agency: {}, rooms: farmRooms };

const councilDocument = {
  _template: { archetype: "municipality" },
  agency: { name: "Municipality" },
  modules: [],
  roles: [{ name: "Mayor" }],
  goals: [],
  objectives: [],
};

const stubTemplateFile = (document: unknown) => {
  const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => document });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
};

const calls = (tool: string) => callToolMock.mock.calls.filter((call) => call[1] === tool);

beforeEach(() => {
  listServicesMock.mockResolvedValue(reply(200, [{ service: serviceName }]));
  importHubMock.mockResolvedValue(reply(200, { instance: { id: "h1", name: "Imported name" } }));
  stubTools();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("setting up a hub from a file document", () => {
  it("imports the document, links the agent role and makes the rooms its rooms key names, in order", async () => {
    const done = vi.fn();
    const hub = await setUpHub("Nyando", roomed, done);
    expect(hub).toEqual({ id: "h1", name: "Imported name", role: "owner" });
    expect(importHubMock).toHaveBeenCalledWith("Nyando", roomed);
    expect(calls("agency_grant_service")[0]).toEqual(["h1", "agency_grant_service", { service: serviceName, agency_role_id: "r1" }]);
    expect(calls("actor_create_group").map((call) => call[2])).toEqual(farmRooms.map((name) => ({ name })));
    expect(calls("actor_set_group_join_mode")).toHaveLength(3);
    expect(done.mock.calls.map((call) => call[0])).toEqual([1, 2, 3]);
  });

  it("opens each room it makes to join, right after making it", async () => {
    stubTools({ actor_create_group: { id: "g" } });
    await setUpHub("Nyando", { rooms: ["One", "Two"] });
    expect(callToolMock.mock.calls.filter((call) => call[1].startsWith("actor_")).map((call) => [call[1], call[2]])).toEqual([
      ["actor_create_group", { name: "One" }],
      ["actor_set_group_join_mode", { group_id: "g", join_mode: "open" }],
      ["actor_create_group", { name: "Two" }],
      ["actor_set_group_join_mode", { group_id: "g", join_mode: "open" }],
    ]);
  });

  it("makes exactly the rooms the document names and no others", async () => {
    await setUpHub("Nyando", { agency: {}, rooms: ["Council chamber"] });
    expect(calls("actor_create_group").map((call) => call[2])).toEqual([{ name: "Council chamber" }]);
    expect(calls("actor_set_group_join_mode")).toHaveLength(1);
  });

  it("makes no rooms for a document with no rooms key, and still reports the three stages", async () => {
    const done = vi.fn();
    await setUpHub("Nyando", councilDocument, done);
    expect(calls("actor_create_group")).toHaveLength(0);
    expect(calls("actor_set_group_join_mode")).toHaveLength(0);
    expect(done.mock.calls.map((call) => call[0])).toEqual([1, 2, 3]);
  });

  it("makes no rooms for a document whose rooms key is empty", async () => {
    await setUpHub("Nyando", { agency: {}, rooms: [] });
    expect(calls("actor_create_group")).toHaveLength(0);
    expect(calls("actor_set_group_join_mode")).toHaveLength(0);
  });

  it("hands the rooms it made to the done callback at the last stage", async () => {
    const done = vi.fn();
    await setUpHub("Nyando", roomed, done);
    expect(done.mock.calls[2]).toEqual([3, { id: "h1", name: "Imported name", role: "owner" }, farmRooms]);
  });

  it("hands an empty list of rooms to the done callback for a council document", async () => {
    const done = vi.fn();
    await setUpHub("Nyando", councilDocument, done);
    expect(done.mock.calls[2][2]).toEqual([]);
  });

  it("falls back to the typed name when the server returns none", async () => {
    importHubMock.mockResolvedValue(reply(200, { instance: { id: "h1" } }));
    expect((await setUpHub("Nyando", {})).name).toBe("Nyando");
  });

  it("never fetches a template for a file document", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await setUpHub("Nyando", {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("setting up a hub from a named template", () => {
  it("loads the template file by encoded name", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ agency: { name: "T" } }) });
    vi.stubGlobal("fetch", fetchSpy);
    await setUpHub("Nyando", "a b/c");
    expect(fetchSpy).toHaveBeenCalledWith("/templates/a%20b%2Fc.json");
    expect(importHubMock).toHaveBeenCalledWith("Nyando", { agency: { name: "T" } });
  });

  it.each([
    ["the file is missing", { ok: false, json: async () => ({}) }],
    ["the file is not JSON", { ok: true, json: async () => Promise.reject(new Error("bad")) }],
    ["the file is a list", { ok: true, json: async () => [] }],
    ["the file is null", { ok: true, json: async () => null }],
  ])("reports no template when %s", async (_, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const failure = await failureOf(setUpHub("N", "lab"));
    expect(failure.reason).toEqual({ key: "createNoTemplate" });
    expect(failure.stage).toBe(0);
    expect(importHubMock).not.toHaveBeenCalled();
  });

  it("makes the three farm rooms from the farmers template when its file names none", async () => {
    stubTemplateFile({ agency: { name: "Farmers" }, roles: [{}] });
    const done = vi.fn();
    await setUpHub("Nyando", "farmers", done);
    expect(calls("actor_create_group").map((call) => call[2])).toEqual(farmRooms.map((name) => ({ name })));
    expect(calls("actor_set_group_join_mode")).toHaveLength(3);
    expect(done.mock.calls[2][2]).toEqual(farmRooms);
  });

  it("prefers the rooms the template file names over the built-in ones for its id", async () => {
    stubTemplateFile({ agency: { name: "Farmers" }, rooms: ["Cooperative room"] });
    await setUpHub("Nyando", "farmers", vi.fn());
    expect(calls("actor_create_group").map((call) => call[2])).toEqual([{ name: "Cooperative room" }]);
  });

  it("makes no rooms from the municipality template, a council with roles and no rooms", async () => {
    const fetchSpy = stubTemplateFile(councilDocument);
    const done = vi.fn();
    await setUpHub("Nyando", "municipality", done);
    expect(fetchSpy).toHaveBeenCalledWith("/templates/municipality.json");
    expect(importHubMock).toHaveBeenCalledWith("Nyando", councilDocument);
    expect(calls("actor_create_group")).toHaveLength(0);
    expect(calls("actor_set_group_join_mode")).toHaveLength(0);
    expect(done.mock.calls.map((call) => call[0])).toEqual([1, 2, 3]);
    expect(done.mock.calls[2][2]).toEqual([]);
  });

  it("makes no rooms from a template id that has no built-in rooms", async () => {
    stubTemplateFile({ agency: { name: "Lab" } });
    await setUpHub("Nyando", "siaya-lab");
    expect(calls("actor_create_group")).toHaveLength(0);
  });

  it("reports no template when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await failureOf(setUpHub("N", "lab"))).reason).toEqual({ key: "createNoTemplate" });
  });
});

describe("the first stage refusing", () => {
  it("reports a missing hub-steward service before importing anything", async () => {
    listServicesMock.mockResolvedValue(reply(200, [{ service: "other" }]));
    const failure = await failureOf(setUpHub("N", {}));
    expect(failure.reason).toEqual({ key: "createNoService" });
    expect(importHubMock).not.toHaveBeenCalled();
  });

  it("reports an empty service list as no service", async () => {
    listServicesMock.mockResolvedValue(reply(200, null));
    expect((await failureOf(setUpHub("N", {}))).reason).toEqual({ key: "createNoService" });
  });

  it.each([401, 403])("marks a %i from the service list as unauthorized", async (status) => {
    listServicesMock.mockResolvedValue(reply(status, { error: " Sign in first " }));
    const failure = await failureOf(setUpHub("N", {}));
    expect(failure.unauthorized).toBe(true);
    expect(failure.reason).toEqual({ text: "Sign in first" });
  });

  it("does not mark a 500 as unauthorized and falls back to the generic key for a blank reason", async () => {
    listServicesMock.mockResolvedValue(reply(500, { error: "   " }));
    const failure = await failureOf(setUpHub("N", {}));
    expect(failure.unauthorized).toBe(false);
    expect(failure.reason).toEqual({ key: "submitFailed" });
  });

  it("falls back to the generic key when the failure body is not an object", async () => {
    listServicesMock.mockResolvedValue(reply(500, "boom"));
    expect((await failureOf(setUpHub("N", {}))).reason).toEqual({ key: "submitFailed" });
  });

  it("shows the server's reason when the import is refused", async () => {
    importHubMock.mockResolvedValue(reply(422, { error: "name taken" }));
    const failure = await failureOf(setUpHub("N", {}));
    expect(failure.reason).toEqual({ text: "name taken" });
    expect(failure.stage).toBe(0);
  });

  it.each([[{ instance: {} }], [{ instance: { id: "" } }], [{}], [{ instance: { id: 7 } }]])("refuses an import reply with no usable id %j", async (data) => {
    importHubMock.mockResolvedValue(reply(200, data));
    expect((await failureOf(setUpHub("N", {}))).reason).toEqual({ key: "submitFailed" });
  });

  it("marks a thrown unauthorized tool error and keeps stage 0", async () => {
    listServicesMock.mockRejectedValue(new McpError("no", true));
    const failure = await failureOf(setUpHub("N", {}));
    expect(failure.unauthorized).toBe(true);
    expect(failure.stage).toBe(0);
  });
});

describe("choosing the agent role to link", () => {
  const grantedRole = async (roles: unknown, drafts: unknown = [{ id: "d1", description: "Imported from x" }]) => {
    stubTools({ agency_list_roles: roles, agency_list_drafts: drafts });
    await setUpHub("N", {});
    return (calls("agency_grant_service")[0]?.[2] as { agency_role_id: string }).agency_role_id;
  };

  it("prefers the Hub Steward role among those allowed to use AI", async () => {
    expect(
      await grantedRole([
        { id: "a", name: "Other", permissions: [agentPermission] },
        { id: "b", name: agentRoleName, permissions: [agentPermission] },
      ]),
    ).toBe("b");
  });

  it("takes the first AI role when none is named Hub Steward", async () => {
    expect(
      await grantedRole([
        { id: "a", name: "Plain", permissions: [] },
        { id: "b", name: "Bot", permissions: [agentPermission] },
      ]),
    ).toBe("b");
  });

  it("treats the permission the agents page exports as the one that makes a role an agent", async () => {
    expect(
      await grantedRole([
        { id: "a", name: agentRoleName, permissions: [] },
        { id: "b", name: "Bot", permissions: [agentPermission] },
      ]),
    ).toBe("b");
  });

  it("takes the role named Hub Steward when no role may use AI", async () => {
    expect(
      await grantedRole([
        { id: "a", name: "Plain" },
        { id: "b", name: agentRoleName },
      ]),
    ).toBe("b");
  });

  it("prefers the draft that says it was imported", async () => {
    stubTools({
      agency_list_drafts: [
        { id: "old", description: "hand made" },
        { id: "new", description: "Imported from file.json" },
      ],
    });
    await setUpHub("N", {});
    expect(calls("agency_list_roles")[0][2]).toEqual({ draft_id: "new" });
  });

  it("uses the first draft when none says it was imported", async () => {
    stubTools({ agency_list_drafts: [{ id: "first", description: "x" }, { id: "second" }] });
    await setUpHub("N", {});
    expect(calls("agency_list_roles")[0][2]).toEqual({ draft_id: "first" });
  });

  it("ignores roles with no id", async () => {
    expect(await grantedRole([{ name: agentRoleName, permissions: [agentPermission] }, { id: "ok", name: "Bot", permissions: [agentPermission] }])).toBe("ok");
  });

  it.each([
    ["no drafts", [], [{ id: "r" }]],
    ["a draft with no id", [{ description: "Imported from x" }], [{ id: "r" }]],
    ["no roles", [{ id: "d" }], []],
    ["roles that are neither AI nor Hub Steward", [{ id: "d" }], [{ id: "r", name: "Plain", permissions: [] }]],
  ])("reports no role for %s", async (_, drafts, roles) => {
    stubTools({ agency_list_drafts: drafts, agency_list_roles: roles });
    const failure = await failureOf(setUpHub("N", {}));
    expect(failure.reason).toEqual({ key: "createNoRole" });
    expect(failure.stage).toBe(1);
    expect(calls("actor_create_group")).toHaveLength(0);
  });
});

describe("later stages failing", () => {
  it("reports the link as failed at stage 1 and keeps the hub unmade of rooms", async () => {
    stubTools({ agency_grant_service: new McpError("denied", true) });
    const failure = await failureOf(setUpHub("N", {}));
    expect(failure.reason).toEqual({ key: "createNotLinked" });
    expect(failure.unauthorized).toBe(true);
    expect(failure.stage).toBe(1);
  });

  it("reports the role listing failing as not linked", async () => {
    stubTools({ agency_list_drafts: new Error("down") });
    const failure = await failureOf(setUpHub("N", {}));
    expect(failure.reason).toEqual({ key: "createNotLinked" });
    expect(failure.stage).toBe(1);
  });

  it("reports a room with no id as the rooms failing at stage 2", async () => {
    stubTools({ actor_create_group: {} });
    const failure = await failureOf(setUpHub("N", roomed));
    expect(failure.reason).toEqual({ key: "createNoRooms" });
    expect(failure.stage).toBe(2);
    expect(calls("actor_create_group")).toHaveLength(1);
  });

  it("stops making rooms when setting the join mode fails", async () => {
    stubTools({ actor_set_group_join_mode: new Error("no") });
    const failure = await failureOf(setUpHub("N", roomed));
    expect(failure.reason).toEqual({ key: "createNoRooms" });
    expect(calls("actor_create_group")).toHaveLength(1);
  });

  it("does not report completion of a stage that failed", async () => {
    stubTools({ actor_create_group: new Error("no") });
    const done = vi.fn();
    await failureOf(setUpHub("N", roomed, done));
    expect(done.mock.calls.map((call) => call[0])).toEqual([1, 2]);
  });
});
