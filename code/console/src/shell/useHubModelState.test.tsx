import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAccounts, type Account } from "../data/accounts";
import { stateOf } from "../data/hubKind";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { announceHubModelChange, useHubModelState } from "./useHubModelState";

const session = vi.hoisted(() => ({ spy: null as null | ((hub: unknown) => void) }));

vi.mock("../data/accounts");
vi.mock("../session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../session")>();
  return {
    ...actual,
    useSession: () => {
      const real = actual.useSession();
      return session.spy ? { ...real, updateHub: session.spy } : real;
    },
  };
});

const anAccount = (over: Partial<Account> = {}): Account => ({
  id: "c1",
  name: "Hugging Face",
  provider: "openai_compatible",
  baseUrl: "https://router.huggingface.co/v1",
  modelName: "zai-org/GLM-5.3:novita",
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

const withKey = [anAccount()];
const withoutKey = [anAccount({ keySet: false })];

const lab: Hub = { id: "siaya", name: "Siaya Community Computer Lab", role: "owner" };
const farmers: Hub = { id: "kisumu", name: "Kisumu Farmers' Group", role: "owner", model_key_set: true };

const updateHub = vi.fn();

const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider>{children}</SessionProvider>;

const open = (hub: Hub, page = "status") =>
  renderHook(({ shown, where }) => useHubModelState(shown, where), { wrapper, initialProps: { shown: hub, where: page } });

const settle = () => act(async () => {});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  updateHub.mockReset();
  session.spy = updateHub;
  vi.mocked(listAccounts).mockReset();
  vi.mocked(listAccounts).mockResolvedValue(withKey);
});

describe("the model state of the hub that is open", () => {
  it("reads the accounts of the hub opened, once", async () => {
    const { rerender } = open(lab);
    await settle();

    rerender({ shown: lab, where: "status" });
    await settle();

    expect(vi.mocked(listAccounts).mock.calls).toEqual([["siaya"]]);
  });

  it("marks the hub as having a model key when an account holds one", async () => {
    open(lab);
    await settle();

    expect(updateHub).toHaveBeenCalledTimes(1);
    expect(updateHub).toHaveBeenCalledWith({ ...lab, model_key_set: true });
  });

  it("marks the hub as having no model key when no account holds one", async () => {
    vi.mocked(listAccounts).mockResolvedValue(withoutKey);
    open(farmers);
    await settle();

    expect(updateHub).toHaveBeenCalledTimes(1);
    expect(updateHub).toHaveBeenCalledWith({ ...farmers, model_key_set: false });
  });

  it("marks the hub as having no model key when it has no account at all", async () => {
    vi.mocked(listAccounts).mockResolvedValue([]);
    open(farmers);
    await settle();

    expect(updateHub).toHaveBeenCalledWith({ ...farmers, model_key_set: false });
  });

  it("leaves the hub alone when it already says what the accounts say", async () => {
    open(farmers);
    await settle();

    expect(updateHub).not.toHaveBeenCalled();
  });

  it("reads a hub that says nothing about a key as having none", async () => {
    vi.mocked(listAccounts).mockResolvedValue(withoutKey);
    open(lab);
    await settle();

    expect(updateHub).not.toHaveBeenCalled();
  });

  it("reads the accounts again when the page changes", async () => {
    const { rerender } = open(farmers, "models");
    await settle();
    expect(listAccounts).toHaveBeenCalledTimes(1);

    vi.mocked(listAccounts).mockResolvedValue(withoutKey);
    rerender({ shown: farmers, where: "agents" });
    await settle();

    expect(listAccounts).toHaveBeenCalledTimes(2);
    expect(updateHub).toHaveBeenCalledWith({ ...farmers, model_key_set: false });
  });

  it("reads the accounts again when something announces that the models changed", async () => {
    vi.mocked(listAccounts).mockResolvedValue(withoutKey);
    open(lab, "models");
    await settle();
    expect(updateHub).not.toHaveBeenCalled();

    vi.mocked(listAccounts).mockResolvedValue(withKey);
    act(() => announceHubModelChange());
    await settle();

    expect(listAccounts).toHaveBeenCalledTimes(2);
    expect(updateHub).toHaveBeenCalledWith({ ...lab, model_key_set: true });
  });

  it("stops listening for the announcement once the hub is closed", async () => {
    const { unmount } = open(lab);
    await settle();
    vi.mocked(listAccounts).mockClear();

    unmount();
    act(() => announceHubModelChange());
    await settle();

    expect(listAccounts).not.toHaveBeenCalled();
  });

  it("keeps what the hub says when the accounts cannot be read, and reads them again on the next page", async () => {
    vi.mocked(listAccounts).mockRejectedValue(new Error("wakala answered 500: down"));
    const { rerender } = open(farmers);
    await settle();
    expect(updateHub).not.toHaveBeenCalled();

    vi.mocked(listAccounts).mockResolvedValue(withoutKey);
    rerender({ shown: farmers, where: "models" });
    await settle();

    expect(updateHub).toHaveBeenCalledWith({ ...farmers, model_key_set: false });
  });

  it("keeps what the hub says when reading the accounts fails before it starts", async () => {
    vi.mocked(listAccounts).mockImplementation(() => {
      throw new TypeError("not a function");
    });
    open(farmers);
    await settle();

    expect(updateHub).not.toHaveBeenCalled();
  });

  it("opens a second hub with its own read and drops an answer that arrives for the hub left behind", async () => {
    const late = deferred<Account[]>();
    vi.mocked(listAccounts).mockImplementation((hubId) => (hubId === "siaya" ? late.promise : Promise.resolve(withoutKey)));
    const { rerender } = open(lab);
    rerender({ shown: farmers, where: "status" });
    await settle();
    updateHub.mockClear();

    late.resolve(withKey);
    await settle();

    expect(updateHub).not.toHaveBeenCalled();
    expect(vi.mocked(listAccounts).mock.calls).toEqual([["siaya"], ["kisumu"]]);
  });

  it("changes the hub as it is when the answer arrives, not as it was when the question was asked", async () => {
    const late = deferred<Account[]>();
    vi.mocked(listAccounts).mockReturnValue(late.promise);
    const { rerender } = open(lab);
    rerender({ shown: { ...lab, name: "Siaya Lab (renamed)", kind: "computer lab" }, where: "status" });

    late.resolve(withKey);
    await settle();

    expect(updateHub).toHaveBeenCalledWith({ ...lab, name: "Siaya Lab (renamed)", kind: "computer lab", model_key_set: true });
  });
});

describe("the model state of the hub in the session", () => {
  beforeEach(() => {
    session.spy = null;
  });

  function Console({ page }: { page: string }) {
    const { hubs, startSession } = useSession();
    useEffect(() => startSession([lab, farmers]), [startSession]);
    const hub = hubs.find((candidate) => candidate.id === "siaya");
    return hub ? <Opened hub={hub} page={page} /> : null;
  }

  function Opened({ hub, page }: { hub: Hub; page: string }) {
    useHubModelState(hub, page);
    return <p data-testid="state">{stateOf(hub)}</p>;
  }

  it("turns a hub from Setup to Ready once an account holds a key, and back when it does not", async () => {
    vi.mocked(listAccounts).mockResolvedValue(withoutKey);
    const view = render(
      <SessionProvider>
        <Console page="models" />
      </SessionProvider>,
    );
    await settle();
    expect(screen.getByTestId("state")).toHaveTextContent("setup");

    vi.mocked(listAccounts).mockResolvedValue(withKey);
    view.rerender(
      <SessionProvider>
        <Console page="status" />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));

    vi.mocked(listAccounts).mockResolvedValue(withoutKey);
    act(() => announceHubModelChange());
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("setup"));
  });
});
