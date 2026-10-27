import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPages, pages } from "./fakeRegistry";
import { sendAction } from "./sendAction";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

beforeEach(() => {
  clearPages();
});

const moduleWith = (actions?: Record<string, () => Promise<"done" | "accepted">>) => ({
  spec: { id: "roles", title: "Roles", primary: "", tools: [], columns: [] },
  rows: async () => [],
  actions,
});

describe("sending an action to the module of a page", () => {
  it("runs the action of that page for the hub with the values and answers what it answered", async () => {
    const run = vi.fn(async () => "accepted" as const);
    pages.roles = moduleWith({ roles: run });

    expect(await sendAction("roles", "roles", "h1", { name: "Seed keeper" })).toBe("accepted");
    expect(run).toHaveBeenCalledWith("h1", { name: "Seed keeper" });
  });

  it("answers done when the action made the change at once", async () => {
    pages.roles = moduleWith({ roles: async () => "done" });

    expect(await sendAction("roles", "roles", "h1", {})).toBe("done");
  });

  it("answers failed when the action throws", async () => {
    pages.roles = moduleWith({
      roles: async () => {
        throw new Error("offline");
      },
    });

    expect(await sendAction("roles", "roles", "h1", {})).toBe("failed");
  });

  it("answers failed when the module has no such action", async () => {
    pages.roles = moduleWith({});

    expect(await sendAction("roles", "roles", "h1", {})).toBe("failed");
  });

  it("answers failed when the module has no actions at all", async () => {
    pages.roles = moduleWith();

    expect(await sendAction("roles", "roles", "h1", {})).toBe("failed");
  });

  it("answers failed when the console has no module for the page", async () => {
    expect(await sendAction("roles", "roles", "h1", {})).toBe("failed");
  });
});
