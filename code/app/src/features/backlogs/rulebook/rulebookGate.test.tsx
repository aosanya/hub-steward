import { cleanup, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency } from "../../../shared/wakala/openAgency";
import { guardedRulebook } from "./access";
import { RecordPage } from "./RecordPage";
import { RulebookPage } from "./RulebookPage";
import { arrive, at, backlogsClient, clientOf, ready, rule } from "./rulebookFixture";
import { useMayReadRules } from "./useMayReadRules";

vi.mock("../../../shared/wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/wakala/mcp")>("../../../shared/wakala/mcp");
  return { ...actual, callTool: async () => ({ items: [] }) };
});

beforeEach(arrive);

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const noAccess = "You do not have access to the rules yet. Ask the Product owner.";

const listAt = (client: ReturnType<typeof clientOf>, ask: () => Promise<boolean>) =>
  at("/a/hub-1/backlogs/b1/rulebook?kind=rule", "/a/:agencyId/backlogs/:backlogId/rulebook", <RulebookPage client={guardedRulebook(client, ask)} backlogs={backlogsClient} />);

describe("the typed rulebook address for a viewer without rule.read", () => {
  it("shows one no-access card on the list and makes no list call", async () => {
    const client = clientOf();
    listAt(client, async () => false);
    expect(await screen.findByText(noAccess)).toBeInTheDocument();
    expect(client.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
  });

  it("shows the same card on a record and opens nothing", async () => {
    const client = clientOf();
    at("/a/hub-1/backlogs/rule/R-2", "/a/:agencyId/backlogs/rule/:ruleCode", <RecordPage client={guardedRulebook(client, async () => false)} files={{ folders: async () => [] }} />);
    expect(await screen.findByText(noAccess)).toBeInTheDocument();
    expect(client.open).not.toHaveBeenCalled();
  });
});

describe("a viewer with rule.read", () => {
  it("sees the list and the three choices", async () => {
    listAt(clientOf({ list: async () => ready([rule()]) }), async () => true);
    expect(await screen.findByText("1 rule")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Questions" })).toBeInTheDocument();
  });

  it("sees a failed list as could not be loaded, not as no access", async () => {
    listAt(clientOf({ list: async () => ({ state: "failed" }) }), async () => true);
    expect(await screen.findByText("The rules could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText(noAccess)).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("sees a refusal after a yes as could not be loaded too", async () => {
    listAt(clientOf({ list: async () => ({ state: "forbidden" }) }), async () => true);
    expect(await screen.findByText("The rules could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText(noAccess)).toBeNull();
  });

  it("is told no access, not failed, when the roles cannot be read", async () => {
    listAt(clientOf(), async () => {
      throw new Error("offline");
    });
    expect(await screen.findByText("The rules could not be loaded.")).toBeInTheDocument();
  });
});

describe("the choices of the switch", () => {
  it("are off while the roles load and on for rule.read", async () => {
    const { result } = renderHook(() => useMayReadRules(async () => true));
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stay off without rule.read", async () => {
    const ask = vi.fn(async () => false);
    const { result } = renderHook(() => useMayReadRules(ask));
    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it("stay off when the roles cannot be read", async () => {
    const ask = vi.fn(async () => {
      throw new Error("offline");
    });
    const { result } = renderHook(() => useMayReadRules(ask));
    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
