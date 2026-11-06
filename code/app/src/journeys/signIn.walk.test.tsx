import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { openAgencyId } from "../agency/open";
import { provideEntryClient, type Agency, type DirectoryAgency, type EntryClient } from "../entry/api";
import { wordsFor } from "../entry/language";
import { formsWaiting, provideWaitingCount } from "../entry/waiting";
import { languages, words } from "../entry/words";
import { callTool, resetMcp } from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { forgetToken, storedToken } from "../wakala/token";
import { endInAgencies, farmers, riders, startInAgencies } from "./inAgency.test-support";

const memberAddress = "asha@example.org";
const link = "/sign-in/link#access_token=t1&expires_in=3600&refresh_token=r1&token_type=bearer&type=magiclink";
const kiswahili = languages.find((language) => language.code === "sw")!;

const nakuru: DirectoryAgency = { id: "agency-nakuru", name: "Nakuru Growers", kind: "farmers group", purpose: "Growers around Nakuru", joinMode: "approval" };
const eldoret: DirectoryAgency = { id: "agency-eldoret", name: "Eldoret Millers", kind: "co-operative", purpose: "Millers in Eldoret", joinMode: "open" };

const fakeEntry = () => {
  const addressesSentTo: string[] = [];
  const joinsAsked: string[] = [];
  const memberOf: Agency[] = [farmers, riders];
  const directory = [nakuru, eldoret];
  const client: EntryClient = {
    sendSignInLink: async (email) => {
      addressesSentTo.push(email);
      return "sent";
    },
    listAgencies: async () => memberOf,
    searchDirectory: async (query) => directory.filter((agency) => agency.name.toLowerCase().includes(query.toLowerCase())),
    join: async (agencyId) => {
      joinsAsked.push(agencyId);
      return directory.find((agency) => agency.id === agencyId)?.joinMode === "open" ? "joined" : "requested";
    },
  };
  return { client, addressesSentTo, joinsAsked };
};

const fakeServer = () => {
  const server = { answering: true };
  const fetcher = vi.fn(async (url: string, init?: RequestInit): Promise<Record<string, unknown>> => {
    if (url.endsWith("/me")) {
      const bearer = (init?.headers as Record<string, string> | undefined)?.Authorization;
      const status = server.answering && bearer === "Bearer t1" ? 200 : 401;
      return { ok: status === 200, status, json: async () => ({ subject: "m7" }) };
    }
    if (url.endsWith("/auth/refresh")) return { ok: false, status: 401, json: async () => ({}), text: async () => "ended" };
    if (!server.answering) return { ok: false, status: 401, headers: new Headers(), text: async () => "refused", json: async () => ({}) };
    const body = JSON.parse(String(init?.body || "{}"));
    const result = body.method === "tools/call" ? { structuredContent: { items: [] } } : {};
    const text = JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, result });
    return { ok: true, status: 200, headers: new Headers({ "Mcp-Session-Id": "s1" }), text: async () => text };
  });
  vi.stubGlobal("fetch", fetcher);
  return server;
};

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const heading = (name: string) => screen.findByRole("heading", { name });

beforeEach(() => {
  startInAgencies();
  resetMcp();
  forgetSubject();
  forgetToken();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  endInAgencies();
  forgetSubject();
  forgetToken();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("journey 21: sign in and choose an agency", () => {
  it("sends the link, picks a language, shows the agencies, joins one, opens one and is sent back to Sign in when a call is refused", async () => {
    const entry = fakeEntry();
    provideEntryClient(entry.client);
    provideWaitingCount(async (agencyId) => (agencyId === farmers.id ? 2 : 0));
    const server = fakeServer();

    open("/sign-in");
    await heading(words.signInTitle);

    await userEvent.click(screen.getByRole("button", { name: words.changeLanguage }));
    await heading(words.selectLanguageTitle);
    languages.forEach((language) => expect(screen.getByRole("button", { name: language.name })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: kiswahili.name }));
    await heading(wordsFor("sw").signInTitle);
    expect(window.localStorage.getItem("hub.language")).toBe("sw");
    await userEvent.click(screen.getByRole("button", { name: wordsFor("sw").changeLanguage }));
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    await heading(words.signInTitle);

    await userEvent.type(screen.getByLabelText(words.signInEmail), memberAddress);
    await userEvent.click(screen.getByRole("button", { name: words.signInSend }));
    expect(await screen.findByText(words.signInSent)).toBeInTheDocument();
    expect(entry.addressesSentTo).toEqual([memberAddress]);

    cleanup();
    open(link);
    await heading(words.agenciesTitle);
    expect(storedToken()?.accessToken).toBe("t1");
    expect(await screen.findByText(farmers.name)).toBeInTheDocument();
    expect(screen.getByText(riders.name)).toBeInTheDocument();
    expect(await screen.findByText(formsWaiting(2, words))).toBeInTheDocument();
    expect(screen.getAllByText(/forms? waiting/)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: words.findAgencyTitle }));
    await heading(words.findAgencyTitle);
    expect(await screen.findByText(nakuru.name)).toBeInTheDocument();
    expect(screen.getByText(eldoret.name)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(words.findAgencyQuery), "nak");
    await userEvent.click(screen.getByRole("button", { name: words.findAgencySearch }));
    await waitFor(() => expect(screen.queryByText(eldoret.name)).not.toBeInTheDocument());
    await userEvent.click(screen.getByText(nakuru.name));
    await heading(nakuru.name);
    expect(screen.getByText(nakuru.purpose)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.agencyAskToJoin }));
    expect(await screen.findByText(words.agencyRequested)).toBeInTheDocument();
    expect(entry.joinsAsked).toEqual([nakuru.id]);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await heading(words.findAgencyTitle);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await heading(words.agenciesTitle);

    await userEvent.click(await screen.findByRole("button", { name: new RegExp(farmers.name) }));
    await heading("Do Something");
    expect(openAgencyId()).toBe(farmers.id);

    server.answering = false;
    await callTool(farmers.id, "agency_list_instances").catch(() => undefined);
    await heading(words.signInTitle);
    expect(await screen.findByText(words.signInSessionEnded)).toBeInTheDocument();
  });
});
