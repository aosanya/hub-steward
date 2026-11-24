import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../entry/api", () => ({ wakalaFetch: vi.fn() }));

let wakalaFetch: typeof import("../entry/api").wakalaFetch;
let httpAssumedGroupsClient: typeof import("./assumedApi").httpAssumedGroupsClient;

const reply = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const lastCall = () => vi.mocked(wakalaFetch).mock.calls.at(-1)!;

beforeEach(async () => {
  vi.resetModules();
  ({ wakalaFetch } = await import("../entry/api"));
  ({ httpAssumedGroupsClient } = await import("./assumedApi"));
});

describe("reading the groups of the login session", () => {
  it("asks GET my-groups of the hub and keeps each group's id, name and roles with the one assumed", async () => {
    vi.mocked(wakalaFetch).mockResolvedValue(
      reply(200, {
        instance_id: "hub-1",
        groups: [
          { id: "g1", name: "EMEA", roles: ["Practice Director", "Reviewer"] },
          { id: "g2", name: "Americas", roles: ["Reviewer"] },
        ],
        assumed_group_id: "g2",
      }),
    );
    const reading = await httpAssumedGroupsClient.read("hub-1");
    expect(lastCall()[0]).toBe("/instances/hub-1/my-groups");
    expect(lastCall()[1]).toMatchObject({ method: "GET" });
    expect(reading).toEqual({
      groups: [
        { id: "g1", name: "EMEA", roles: ["Practice Director", "Reviewer"] },
        { id: "g2", name: "Americas", roles: ["Reviewer"] },
      ],
      assumedId: "g2",
    });
  });

  it("reads a group with no roles and a session with no choice", async () => {
    vi.mocked(wakalaFetch).mockResolvedValue(reply(200, { groups: [{ id: "g1", name: "EMEA" }, { name: "no id" }], assumed_group_id: "" }));
    expect(await httpAssumedGroupsClient.read("hub-1")).toEqual({ groups: [{ id: "g1", name: "EMEA", roles: [] }], assumedId: "" });
  });

  it("reads a person with no seat as an empty list", async () => {
    vi.mocked(wakalaFetch).mockResolvedValue(reply(200, { groups: [], assumed_group_id: "" }));
    expect(await httpAssumedGroupsClient.read("hub-1")).toEqual({ groups: [], assumedId: "" });
  });

  it("names the hub in the path with its characters encoded", async () => {
    vi.mocked(wakalaFetch).mockResolvedValue(reply(200, { groups: [] }));
    await httpAssumedGroupsClient.read("a b/1");
    expect(lastCall()[0]).toBe("/instances/a%20b%2F1/my-groups");
  });

  it("fails when the hub does not answer 200", async () => {
    vi.mocked(wakalaFetch).mockResolvedValue(reply(404));
    await expect(httpAssumedGroupsClient.read("hub-1")).rejects.toThrow();
  });
});

describe("assuming a group", () => {
  it("sends PUT my-group with the group's id", async () => {
    vi.mocked(wakalaFetch).mockResolvedValue(reply(200, { group: { id: "g2", name: "Americas" } }));
    await httpAssumedGroupsClient.assume("hub-1", "g2");
    expect(lastCall()[0]).toBe("/instances/hub-1/my-group");
    expect(lastCall()[1]).toMatchObject({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ group_id: "g2" }) });
  });

  it("fails when the hub refuses the group", async () => {
    vi.mocked(wakalaFetch).mockResolvedValue(reply(403));
    await expect(httpAssumedGroupsClient.assume("hub-1", "g9")).rejects.toThrow();
  });
});
