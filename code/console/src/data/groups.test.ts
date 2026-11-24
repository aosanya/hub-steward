import { afterEach, describe, expect, it, vi } from "vitest";
import { assumeGroup, listMyGroups } from "./groups";

vi.mock("./groups", async (importOriginal) => importOriginal());

const reply = (status: number, data: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

const stubFetch = (answer: ReturnType<typeof reply>) => {
  const fetchMock = vi.fn(async () => answer);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listMyGroups", () => {
  it("reads GET my-groups of the hub with the session cookie and maps each group", async () => {
    const fetchMock = stubFetch(
      reply(200, {
        groups: [
          { id: "g1", name: "Siaya farmers", roles: ["Farmer"], tags: ["siaya"] },
          { id: "g2", name: "Supplier", roles: ["Supplier", "Reviewer"] },
        ],
        assumed_group_id: "g2",
      }),
    );

    const choice = await listMyGroups("siaya");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://wakala.test/instances/siaya/my-groups",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(choice).toEqual({
      groups: [
        { id: "g1", name: "Siaya farmers", roles: ["Farmer"], tags: ["siaya"] },
        { id: "g2", name: "Supplier", roles: ["Supplier", "Reviewer"] },
      ],
      assumedId: "g2",
    });
  });

  it("reads a person with no seat as no groups and no choice", async () => {
    stubFetch(reply(200, { groups: [], assumed_group_id: "" }));

    expect(await listMyGroups("siaya")).toEqual({ groups: [], assumedId: "" });
  });

  it("leaves out an entry without an id and reads a missing roles list as none", async () => {
    stubFetch(reply(200, { groups: [{ name: "No id" }, { id: "g1", name: "Kept" }] }));

    expect(await listMyGroups("siaya")).toEqual({ groups: [{ id: "g1", name: "Kept", roles: [] }], assumedId: "" });
  });

  it("refuses when the hub does not answer well", async () => {
    stubFetch(reply(404, { error: "not a member" }));

    await expect(listMyGroups("siaya")).rejects.toThrow();
  });
});

describe("assumeGroup", () => {
  it("sends PUT my-group with the group id", async () => {
    const fetchMock = stubFetch(reply(200, { group: { id: "g2", name: "Supplier" } }));

    await assumeGroup("siaya", "g2");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://wakala.test/instances/siaya/my-group",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ group_id: "g2" }), credentials: "include" }),
    );
  });

  it("refuses when the hub refuses the group", async () => {
    stubFetch(reply(403, { error: "no seat" }));

    await expect(assumeGroup("siaya", "g2")).rejects.toThrow();
  });
});
