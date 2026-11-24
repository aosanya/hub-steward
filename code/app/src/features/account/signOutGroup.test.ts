import { afterEach, describe, expect, it, vi } from "vitest";
import { assumedGroupNow, forgetAssumedGroup, rememberAssumedGroup } from "../../shared/wakala/assumedGroup";
import { signOut } from "./signOut";

afterEach(() => {
  vi.unstubAllGlobals();
  forgetAssumedGroup();
});

describe("signing out", () => {
  it("forgets the assumed group, because the choice belongs to one login session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    rememberAssumedGroup({ agencyId: "hub-1", id: "g1", name: "EMEA", count: 2 });
    await signOut();
    expect(assumedGroupNow()).toBeNull();
  });
});
