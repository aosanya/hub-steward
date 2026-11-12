import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { forgetSent, markSent, sentSteps, wasSent, wasStarted } from "./sent";

beforeEach(() => {
  window.localStorage.clear();
  openAgency("farmers");
});

afterEach(() => {
  forgetSent();
  forgetOpenAgency();
  vi.resetModules();
  window.localStorage.clear();
});

describe("the Sent mark survives a reload", () => {
  it("is still there when the app code is loaded again", async () => {
    markSent({ id: "s1", orderId: "o1", title: "Referral" });
    vi.resetModules();
    const reloaded = await import("./sent");
    expect(reloaded.wasSent({ id: "s1", orderId: "o1" })).toBe(true);
    expect(reloaded.wasStarted("s1")).toBe(true);
    expect(reloaded.sentSteps()).toEqual([{ id: "s1", orderId: "o1", title: "Referral", agencyId: "farmers" }]);
  });

  it("keeps the local run numbers going after a reload, so two sends of a start step stay two", async () => {
    markSent({ id: "s1", orderId: "", title: "Referral" });
    vi.resetModules();
    const reloaded = await import("./sent");
    reloaded.markSent({ id: "s1", orderId: "", title: "Referral" });
    expect(reloaded.sentSteps()).toHaveLength(2);
  });

  it("belongs to the agency it was sent in", () => {
    markSent({ id: "s1", orderId: "o1", title: "Referral" });
    openAgency("clinic");
    expect(wasSent({ id: "s1", orderId: "o1" })).toBe(false);
    expect(wasStarted("s1")).toBe(false);
    expect(sentSteps()).toEqual([]);
  });

  it("is forgotten when forgetSent is called", async () => {
    markSent({ id: "s1", orderId: "o1", title: "Referral" });
    forgetSent();
    vi.resetModules();
    const reloaded = await import("./sent");
    expect(reloaded.wasSent({ id: "s1", orderId: "o1" })).toBe(false);
  });

  it("works from memory when the phone refuses to store anything", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => markSent({ id: "s1", orderId: "o1", title: "Referral" })).not.toThrow();
    expect(wasSent({ id: "s1", orderId: "o1" })).toBe(true);
  });
});
