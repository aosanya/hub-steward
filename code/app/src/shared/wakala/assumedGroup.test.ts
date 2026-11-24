import { afterEach, describe, expect, it, vi } from "vitest";
import { assumedGroupNow, forgetAssumedGroup, rememberAssumedGroup, subscribeAssumedGroup } from "./assumedGroup";

const emea = { agencyId: "hub-1", id: "g1", name: "EMEA", count: 2 };

afterEach(() => forgetAssumedGroup());

describe("the assumed group kept in memory", () => {
  it("starts with no group", () => {
    expect(assumedGroupNow()).toBeNull();
  });

  it("holds the group it was given and tells its listeners", () => {
    const listener = vi.fn();
    const stop = subscribeAssumedGroup(listener);
    rememberAssumedGroup(emea);
    expect(assumedGroupNow()).toEqual(emea);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it("forgets the group and tells its listeners", () => {
    rememberAssumedGroup(emea);
    const listener = vi.fn();
    subscribeAssumedGroup(listener);
    forgetAssumedGroup();
    expect(assumedGroupNow()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("writes nothing to storage, because the choice belongs to one login session", () => {
    rememberAssumedGroup(emea);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("stops telling a listener that has unsubscribed", () => {
    const listener = vi.fn();
    subscribeAssumedGroup(listener)();
    rememberAssumedGroup(emea);
    expect(listener).not.toHaveBeenCalled();
  });
});
