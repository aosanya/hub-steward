import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { resetMcp } from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { forgetToken, storedToken } from "../wakala/token";
import { provideEntryClient } from "./api";
import { words } from "./words";

const link = "/sign-in/link#access_token=t1&expires_in=3600&refresh_token=r1&token_type=bearer&type=magiclink";

type Server = { me: number | "down" };

const meCalls = (fetcher: ReturnType<typeof vi.fn>) =>
  fetcher.mock.calls.filter(([url]) => String(url).endsWith("/me")).map(([, init]) => (init?.headers ?? {}) as Record<string, string>);

const open = (path: string, server: Server) => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/me")) {
      if (server.me === "down") throw new TypeError("offline");
      const bearer = (init?.headers as Record<string, string> | undefined)?.Authorization;
      const status = server.me === 200 && bearer === "Bearer t1" ? 200 : server.me === 200 ? 401 : server.me;
      return { ok: status === 200, status, json: async () => ({ subject: "m7" }) };
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
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return fetcher;
};

describe("opening a sign-in link", () => {
  beforeEach(() => {
    resetMcp();
    forgetSubject();
    forgetToken();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("presents the token to wakala-api as a bearer, keeps it and lands inside the app", async () => {
    const fetcher = open(link, { me: 200 });
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(storedToken()?.accessToken).toBe("t1");
    expect(storedToken()?.refreshToken).toBe("r1");
    expect(meCalls(fetcher).some((headers) => headers.Authorization === "Bearer t1")).toBe(true);
    expect(screen.queryByRole("heading", { name: words.signInTitle })).not.toBeInTheDocument();
  });

  it("takes the fragment out of the address bar", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    open(link, { me: 200 });
    await screen.findByRole("heading", { name: words.agenciesTitle });
    expect(replace).toHaveBeenCalledWith(null, "", window.location.pathname);
  });

  it("lands on Sign in with the failed sentence and keeps nothing when wakala-api refuses the token", async () => {
    open(link, { me: 401 });
    expect(await screen.findByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(words.signInLinkFailed);
    expect(storedToken()).toBeNull();
  });

  it.each(["#error=access_denied&error_code=otp_expired&error_description=Link+expired", "", "#refresh_token=r1"])(
    "lands on Sign in with the failed sentence, without asking wakala-api, for the fragment %j",
    async (fragment) => {
      const fetcher = open(`/sign-in/link${fragment}`, { me: 200 });
      expect(await screen.findByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(words.signInLinkFailed);
      expect(storedToken()).toBeNull();
      expect(meCalls(fetcher).filter((headers) => headers.Authorization)).toEqual([]);
    },
  );

  it("keeps the token when wakala-api cannot be reached, because a link works once", async () => {
    open(link, { me: "down" });
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(storedToken()?.accessToken).toBe("t1");
  });

  it("is not sent to Sign in by the gate while the token is being presented", async () => {
    open(link, { me: 200 });
    await waitFor(() => expect(storedToken()).not.toBeNull());
    expect(screen.queryByText(words.signInSessionEnded)).not.toBeInTheDocument();
  });

  it("shows the failed sentence on Sign in for ?link=failed, in Kiswahili once chosen", () => {
    window.localStorage.setItem("hub.language", "sw");
    open("/sign-in?link=failed", { me: 401 });
    expect(screen.getByRole("alert")).toHaveTextContent("Kiungo hicho cha kuingia hakikufanya kazi");
  });
});
