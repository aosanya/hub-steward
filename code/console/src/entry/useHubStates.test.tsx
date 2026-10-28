import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAccounts, type Account } from "../data/accounts";
import { stateOf } from "../data/hubKind";
import type { Hub } from "../types";
import { hubWithState, useHubStates } from "./useHubStates";

vi.mock("../data/accounts");

const anAccount = (over: Partial<Account> = {}): Account => ({
  id: "c1",
  name: "Claude",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  modelName: "claude-sonnet-5-5",
  status: "enabled",
  keySet: true,
  lastTestResult: "",
  lastTestedAt: "",
  lastTestPrompt: "",
  lastTestReply: "",
  lastTestMs: null,
  chatEnabled: false,
  chatLabel: "",
  ...over,
});

const siaya: Hub = { id: "siaya", name: "Siaya hub", role: "owner" };
const kisumu: Hub = { id: "kisumu", name: "Kisumu hub", role: "owner" };
const nairobi: Hub = { id: "nairobi", name: "Nairobi hub", role: "owner" };

const settle = () => act(async () => {});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const answers = (byHub: Record<string, Account[] | Error>) =>
  vi.mocked(listAccounts).mockImplementation(async (hubId) => {
    const answer = byHub[hubId];
    if (answer instanceof Error) throw answer;
    return answer ?? [];
  });

beforeEach(() => {
  vi.mocked(listAccounts).mockReset();
  answers({});
});

describe("the model state of each listed hub", () => {
  it("is set for a hub with a key on one of its models and not set for a hub with none", async () => {
    answers({ siaya: [anAccount()], kisumu: [anAccount({ keySet: false })], nairobi: [] });

    const { result } = renderHook(() => useHubStates([siaya, kisumu, nairobi]));
    await settle();

    expect(result.current).toEqual({ siaya: true, kisumu: false, nairobi: false });
  });

  it("reads the accounts of each hub, once, all at the same time", async () => {
    const first = deferred<Account[]>();
    const second = deferred<Account[]>();
    vi.mocked(listAccounts).mockImplementation((hubId) => (hubId === "siaya" ? first.promise : second.promise));

    renderHook(() => useHubStates([siaya, kisumu]));
    await settle();

    expect(vi.mocked(listAccounts).mock.calls).toEqual([["siaya"], ["kisumu"]]);
  });

  it("leaves a hub out when its accounts cannot be read, and still answers for the others", async () => {
    answers({ siaya: new Error("down"), kisumu: [anAccount()] });

    const { result } = renderHook(() => useHubStates([siaya, kisumu]));
    await settle();

    expect(result.current).toEqual({ kisumu: true });
  });

  it("answers for each hub as soon as its own accounts arrive", async () => {
    const slow = deferred<Account[]>();
    vi.mocked(listAccounts).mockImplementation((hubId) => (hubId === "siaya" ? slow.promise : Promise.resolve([anAccount()])));

    const { result } = renderHook(() => useHubStates([siaya, kisumu]));
    await settle();
    expect(result.current).toEqual({ kisumu: true });

    slow.resolve([]);
    await settle();
    expect(result.current).toEqual({ kisumu: true, siaya: false });
  });

  it("reads nothing for no hubs", async () => {
    const { result } = renderHook(() => useHubStates([]));
    await settle();

    expect(result.current).toEqual({});
    expect(listAccounts).not.toHaveBeenCalled();
  });

  it("does not read again when the same hubs are listed again, and reads the hubs that were added", async () => {
    answers({ siaya: [anAccount()], kisumu: [anAccount()] });
    const { result, rerender } = renderHook(({ hubs }) => useHubStates(hubs), { initialProps: { hubs: [siaya] } });
    await settle();

    rerender({ hubs: [{ ...siaya }] });
    await settle();
    expect(vi.mocked(listAccounts).mock.calls).toEqual([["siaya"]]);

    rerender({ hubs: [siaya, kisumu] });
    await settle();
    expect(vi.mocked(listAccounts).mock.calls).toEqual([["siaya"], ["siaya"], ["kisumu"]]);
    expect(result.current).toEqual({ siaya: true, kisumu: true });
  });

  it("drops an answer that arrives after the list it was asked for was replaced", async () => {
    const late = deferred<Account[]>();
    vi.mocked(listAccounts).mockImplementation((hubId) => (hubId === "siaya" ? late.promise : Promise.resolve([])));
    const { result, rerender } = renderHook(({ hubs }) => useHubStates(hubs), { initialProps: { hubs: [siaya] } });

    rerender({ hubs: [kisumu] });
    late.resolve([anAccount()]);
    await settle();

    expect(result.current).toEqual({ kisumu: false });
  });
});

describe("a hub with its model state read", () => {
  it("takes the state that was read, over the one the hub carries", () => {
    expect(stateOf(hubWithState(siaya, { siaya: true }))).toBe("ready");
    expect(stateOf(hubWithState({ ...siaya, model_key_set: true }, { siaya: false }))).toBe("setup");
  });

  it("is the hub itself when nothing was read for it", () => {
    const carrying: Hub = { ...siaya, model_key_set: true };

    expect(hubWithState(carrying, { kisumu: false })).toBe(carrying);
    expect(stateOf(hubWithState(siaya, {}))).toBe("setup");
  });
});
