import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { callTool, resetMcp } from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { provideEntryClient } from "./api";
import { words } from "./words";

type Server = { me: number | "down"; mcp: number };

const serve = (server: Server) =>
  vi.fn(async (url: string) => {
    if (url.endsWith("/me")) {
      if (server.me === "down") throw new TypeError("offline");
      return { ok: server.me === 200, status: server.me, json: async () => ({ subject: "m7" }) };
    }
    return { ok: server.mcp === 200, status: server.mcp, headers: new Headers(), text: async () => "refused", json: async () => ({}) };
  });

const open = (path: string, server: Server) => {
  vi.stubGlobal("fetch", serve(server));
  provideEntryClient({
    sendSignInLink: async () => "sent",
    listAgencies: async () => [],
    searchDirectory: async () => [],
    join: async () => "joined",
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
};

const onSignIn = () => screen.queryByRole("heading", { name: words.signInTitle });

describe("sending the member to Sign in", () => {
  beforeEach(() => {
    resetMcp();
    forgetSubject();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("sends a first visit with no session to Sign in without the sentence", async () => {
    open("/agencies", { me: 401, mcp: 401 });
    await waitFor(() => expect(onSignIn()).toBeInTheDocument());
    expect(screen.queryByText(words.signInSessionEnded)).not.toBeInTheDocument();
  });

  it("sends a member whose refused call cannot be renewed to Sign in with the sentence", async () => {
    const server: Server = { me: 200, mcp: 200 };
    open("/agencies", server);
    await screen.findByRole("heading", { name: words.agenciesTitle });
    server.me = 401;
    server.mcp = 401;
    await callTool("", "agency_list_instances").catch(() => {});
    await waitFor(() => expect(onSignIn()).toBeInTheDocument());
    expect(screen.getByText(words.signInSessionEnded)).toBeInTheDocument();
  });

  it("shows the sentence on a later visit once the member had a session", async () => {
    const server: Server = { me: 200, mcp: 200 };
    const first = open("/agencies", server);
    await screen.findByRole("heading", { name: words.agenciesTitle });
    first.unmount();
    server.me = 401;
    open("/agencies", server);
    await waitFor(() => expect(onSignIn()).toBeInTheDocument());
    expect(screen.getByText(words.signInSessionEnded)).toBeInTheDocument();
  });

  it("never sends a signed-in member there when one call is refused", async () => {
    const server: Server = { me: 200, mcp: 403 };
    open("/agencies", server);
    await screen.findByRole("heading", { name: words.agenciesTitle });
    await callTool("", "agency_list_instances").catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSignIn()).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
  });

  it("leaves the member where she is when the server cannot be reached", async () => {
    open("/agencies", { me: "down", mcp: 200 });
    await screen.findByRole("heading", { name: words.agenciesTitle });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSignIn()).not.toBeInTheDocument();
  });

  it("does not send a member who is already on Sign in anywhere", async () => {
    open("/sign-in", { me: 401, mcp: 401 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSignIn()).toBeInTheDocument();
    expect(screen.queryByText(words.signInSessionEnded)).not.toBeInTheDocument();
  });
});
