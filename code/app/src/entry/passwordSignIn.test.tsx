import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { forgetRuntimeConfig, setRuntimeConfig } from "../wakala/config";
import { resetMcp } from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { forgetToken } from "../wakala/token";
import { provideEntryClient } from "./api";
import { hubIsLocal, isLoopbackHost } from "./localHub";
import { words } from "./words";

type Server = { signin: number };

const open = (server: Server, wakala: string) => {
  setRuntimeConfig({ wakala, mcp: `${wakala}/mcp` });
  let signedIn = false;
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/auth/signin")) {
      signedIn = server.signin === 201;
      return { ok: server.signin === 201, status: server.signin, json: async () => ({}) };
    }
    if (url.endsWith("/me")) {
      return { ok: signedIn, status: signedIn ? 200 : 401, json: async () => ({ subject: "m7" }) };
    }
    return { ok: true, status: 200, headers: new Headers(), text: async () => "{}", json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetcher);
  provideEntryClient({
    sendSignInLink: async () => "sent",
    listAgencies: async () => [],
    searchDirectory: async () => [],
    join: async () => "joined",
  });
  render(
    <MemoryRouter initialEntries={["/sign-in"]}>
      <App />
    </MemoryRouter>,
  );
  return fetcher;
};

const signInCalls = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls.filter(([url]) => String(url).endsWith("/auth/signin"));

describe("signing in with a password on a local hub", () => {
  beforeEach(() => {
    resetMcp();
    forgetSubject();
    forgetToken();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    forgetRuntimeConfig();
  });

  it("knows a local hub only when the page and the hub are both on this machine", async () => {
    setRuntimeConfig({ wakala: "http://127.0.0.1:8183", mcp: "" });
    expect(await hubIsLocal({ hostname: "localhost" })).toBe(true);
    expect(await hubIsLocal({ hostname: "[::1]" })).toBe(true);
    expect(await hubIsLocal({ hostname: "app.example.org" })).toBe(false);
    setRuntimeConfig({ wakala: "https://hub.example.org", mcp: "" });
    expect(await hubIsLocal({ hostname: "localhost" })).toBe(false);
    setRuntimeConfig({ wakala: "", mcp: "/mcp" });
    expect(await hubIsLocal({ hostname: "localhost" })).toBe(true);
    expect(isLoopbackHost("localhost.example.org")).toBe(false);
  });

  it("shows the password form on a local hub", async () => {
    open({ signin: 201 }, "http://localhost:8082");
    expect(await screen.findByLabelText(words.signInPassword)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.signInWithPassword })).toBeInTheDocument();
  });

  it("does not show it when the hub is a deployed one", async () => {
    open({ signin: 201 }, "https://hub.example.org");
    expect(await screen.findByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText(words.signInPassword)).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: words.signInWithPassword })).not.toBeInTheDocument();
  });

  it("says the email and password do not match, and stays on Sign in", async () => {
    const fetcher = open({ signin: 401 }, "http://localhost:8082");
    await userEvent.type(await screen.findByLabelText(words.signInEmail), "owner@example.com");
    await userEvent.type(screen.getByLabelText(words.signInPassword), "not-it");
    await userEvent.click(screen.getByRole("button", { name: words.signInWithPassword }));
    expect(await screen.findByText(words.signInWrong)).toBeInTheDocument();
    expect(signInCalls(fetcher)).toHaveLength(1);
    expect(screen.getByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
  });

  it("sends the address and password to the hub with the cookie and lands inside the app", async () => {
    const fetcher = open({ signin: 201 }, "http://localhost:8082");
    await userEvent.type(await screen.findByLabelText(words.signInEmail), "owner@example.com");
    await userEvent.type(screen.getByLabelText(words.signInPassword), "right-one");
    await userEvent.click(screen.getByRole("button", { name: words.signInWithPassword }));
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    const [url, init] = signInCalls(fetcher)[0];
    expect(url).toBe("http://localhost:8082/auth/signin");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(String(init.body))).toEqual({ email: "owner@example.com", password: "right-one" });
  });

  it("says the hub is busy when it has locked the address out", async () => {
    open({ signin: 429 }, "http://localhost:8082");
    await userEvent.type(await screen.findByLabelText(words.signInEmail), "owner@example.com");
    await userEvent.type(screen.getByLabelText(words.signInPassword), "x");
    await userEvent.click(screen.getByRole("button", { name: words.signInWithPassword }));
    expect(await screen.findByText(words.signInBusy)).toBeInTheDocument();
  });
});
