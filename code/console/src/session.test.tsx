import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "./session";
import type { Hub } from "./types";
import { setRuntimeConfig } from "./wakala/config";
import { callTool, resetMcp } from "./wakala/mcp";
import { restoreHubs, signOut } from "./wakala/rest";

vi.mock("./wakala/rest", () => ({ restoreHubs: vi.fn(), signOut: vi.fn() }));

const siaya: Hub = { id: "siaya", name: "Siaya hub", role: "owner" };
const kisumu: Hub = { id: "kisumu", name: "Kisumu hub", role: "owner" };

const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider>{children}</SessionProvider>;

const openSession = () => renderHook(() => useSession(), { wrapper });

beforeEach(() => {
  vi.mocked(restoreHubs).mockReset();
  vi.mocked(signOut).mockReset();
});

const wakalaAnswers = (status: number) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: status < 400, status, headers: new Headers(), text: async () => "authentication required" })),
  );

describe("the session when wakala stops accepting the sign-in", () => {
  beforeEach(() => {
    resetMcp();
    setRuntimeConfig({ wakala: "https://wakala.test", mcp: "https://wakala.test/mcp" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("ends a signed-in session and says it expired when a tool call is answered 401", async () => {
    wakalaAnswers(401);
    const { result } = openSession();
    act(() => result.current.startSession([siaya]));

    await act(async () => {
      await callTool("siaya", "agency_list_roles").catch(() => {});
    });

    expect(result.current.signedIn).toBe(false);
    expect(result.current.expired).toBe(true);
    expect(result.current.hubs).toEqual([]);
  });

  it("does not call a person signed out who was never signed in", async () => {
    wakalaAnswers(401);
    const { result } = openSession();

    await act(async () => {
      await callTool("siaya", "agency_list_roles").catch(() => {});
    });

    expect(result.current.expired).toBe(false);
  });

  it("does not take a 502 for a sign-out", async () => {
    wakalaAnswers(502);
    const { result } = openSession();
    act(() => result.current.startSession([siaya]));

    await act(async () => {
      await callTool("siaya", "agency_list_roles").catch(() => {});
    });

    expect(result.current.signedIn).toBe(true);
    expect(result.current.expired).toBe(false);
  });

  it("clears the expired mark when the person signs in again", async () => {
    wakalaAnswers(401);
    const { result } = openSession();
    act(() => result.current.startSession([siaya]));
    await act(async () => {
      await callTool("siaya", "agency_list_roles").catch(() => {});
    });

    act(() => result.current.startSession([siaya]));

    expect(result.current.expired).toBe(false);
    expect(result.current.signedIn).toBe(true);
  });

  it("does not mark an explicit sign-out as expired", async () => {
    vi.mocked(signOut).mockResolvedValue({ ok: true, status: 204, data: {} });
    const { result } = openSession();
    act(() => result.current.startSession([siaya]));

    await act(async () => result.current.signOut());

    expect(result.current.expired).toBe(false);
  });
});

describe("the session", () => {
  it("starts signed out with no hubs", () => {
    const { result } = openSession();

    expect(result.current.signedIn).toBe(false);
    expect(result.current.hubs).toEqual([]);
  });

  it("signs in with the hubs it is given", () => {
    const { result } = openSession();

    act(() => result.current.startSession([siaya, kisumu]));

    expect(result.current.signedIn).toBe(true);
    expect(result.current.hubs).toEqual([siaya, kisumu]);
  });

  it("restores the hubs wakala lists for the cookie and signs in", async () => {
    vi.mocked(restoreHubs).mockResolvedValue([siaya]);
    const { result } = openSession();

    let restored = false;
    await act(async () => {
      restored = await result.current.restore();
    });

    expect(restored).toBe(true);
    expect(result.current.signedIn).toBe(true);
    expect(result.current.hubs).toEqual([siaya]);
  });

  it("stays signed out when wakala has no session to restore", async () => {
    vi.mocked(restoreHubs).mockResolvedValue(null);
    const { result } = openSession();

    let restored = true;
    await act(async () => {
      restored = await result.current.restore();
    });

    expect(restored).toBe(false);
    expect(result.current.signedIn).toBe(false);
  });

  it("signs out of wakala itself and forgets the hubs", async () => {
    vi.mocked(signOut).mockResolvedValue({ ok: true, status: 204, data: {} });
    const { result } = openSession();
    act(() => result.current.startSession([siaya]));

    await act(async () => result.current.signOut());

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(result.current.signedIn).toBe(false);
    expect(result.current.hubs).toEqual([]);
  });

  it("stays signed in when wakala cannot be reached to sign out", async () => {
    vi.mocked(signOut).mockRejectedValue(new TypeError("network down"));
    const { result } = openSession();
    act(() => result.current.startSession([siaya]));

    await act(async () => {
      await result.current.signOut().catch(() => {});
    });

    expect(result.current.signedIn).toBe(true);
  });

  it("adds a hub to the hubs it holds", () => {
    const { result } = openSession();
    act(() => result.current.startSession([siaya]));

    act(() => result.current.addHub(kisumu));

    expect(result.current.hubs).toEqual([siaya, kisumu]);
  });

  it("replaces a hub it holds by its id", () => {
    const { result } = openSession();
    act(() => result.current.startSession([siaya, kisumu]));

    act(() => result.current.updateHub({ ...siaya, name: "Siaya renamed" }));

    expect(result.current.hubs.map((h) => h.name)).toEqual(["Siaya renamed", "Kisumu hub"]);
  });

  it("refuses to be read outside its provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useSession())).toThrow("useSession needs a SessionProvider");

    quiet.mockRestore();
  });
});
