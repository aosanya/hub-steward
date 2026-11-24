import { afterEach, describe, expect, it, vi } from "vitest";
import { listDisabledGroups, setGroupDisabled } from "./disabledGroups";

const reply = (status: number, data: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

const stubFetch = (answer: ReturnType<typeof reply>) => {
  const fetchMock = vi.fn(async () => answer);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listDisabledGroups", () => {
  it("reads GET disabled-groups of the hub with the session cookie and returns the group ids", async () => {
    const fetchMock = stubFetch(reply(200, { group_ids: ["g1", "g3"] }));

    expect(await listDisabledGroups("siaya")).toEqual(["g1", "g3"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://wakala.test/instances/siaya/disabled-groups",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("reads a reply with no group_ids as no disabled group", async () => {
    stubFetch(reply(200, {}));

    expect(await listDisabledGroups("siaya")).toEqual([]);
  });

  it("throws when the route refuses", async () => {
    stubFetch(reply(404, { error: "not found" }));

    await expect(listDisabledGroups("siaya")).rejects.toThrow("not found");
  });
});

describe("setGroupDisabled", () => {
  it("posts to disable the group", async () => {
    const fetchMock = stubFetch(reply(200, { instance_id: "siaya", group_id: "g1", disabled: true }));

    await setGroupDisabled("siaya", "g1", true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://wakala.test/instances/siaya/groups/g1/disable",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("posts to enable the group", async () => {
    const fetchMock = stubFetch(reply(200, { disabled: false }));

    await setGroupDisabled("siaya", "g1", false);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://wakala.test/instances/siaya/groups/g1/enable",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("throws the refusal the route gives", async () => {
    stubFetch(reply(403, { error: "only the owner may disable a group" }));

    await expect(setGroupDisabled("siaya", "g1", true)).rejects.toThrow("only the owner may disable a group");
  });
});
