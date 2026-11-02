import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { forgetOpenAgency } from "../agency/open";
import { words } from "../entry/words";
import { resetMcp } from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { storedToken } from "../wakala/token";

const hour = 3_600_000;
const aMinuteToGo = 30_000;

const siaya = { id: "agency-siaya", name: "Siaya Farmers Group" };
const kisumu = { id: "agency-kisumu", name: "Kisumu Lab" };
const nakuru = { id: "agency-nakuru", name: "Nakuru Growers", kind: "farmers group", purpose: "Growers around Nakuru", join_mode: "open" };

const answer = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(headers),
  json: async () => body,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

const rpc = (result: unknown) => JSON.stringify({ jsonrpc: "2.0", id: 1, result });

type Refresh = "renews" | "answers nothing";

const wakalaAnswering = () => {
  const accessEnds = new Map<string, number>();
  const refreshTokens = new Set<string>();
  const refreshesAsked: string[] = [];
  const bearers: Array<{ path: string; bearer: string | undefined }> = [];
  let issued = 0;
  let refresh: Refresh = "renews";

  const issue = () => {
    issued += 1;
    const pair = { access_token: `a${issued}`, refresh_token: `r${issued}`, token_type: "bearer", expires_in: hour / 1000 };
    accessEnds.set(pair.access_token, Date.now() + hour);
    refreshTokens.add(pair.refresh_token);
    return pair;
  };

  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    const { pathname } = new URL(input);
    if (pathname === "/auth/refresh") {
      const sent = JSON.parse(String(init?.body)).refresh_token;
      refreshesAsked.push(sent);
      if (!refreshTokens.has(sent)) return answer(401, { error: "that session has ended; sign in again" });
      if (refresh === "answers nothing") return answer(200, {});
      refreshTokens.delete(sent);
      return answer(200, issue());
    }
    const bearer = (init?.headers as Record<string, string>).Authorization?.replace("Bearer ", "");
    bearers.push({ path: pathname, bearer });
    if (bearer === undefined || (accessEnds.get(bearer) ?? 0) <= Date.now()) return answer(401, { error: "authentication required" });
    if (pathname === "/me") return answer(200, { subject: "m7" });
    if (pathname === "/me/agencies") return answer(200, { agencies: [siaya, kisumu] });
    if (pathname === "/directory") return answer(200, [nakuru]);
    const message = JSON.parse(String(init?.body));
    const reply = message.method === "tools/call" ? rpc({ structuredContent: { items: [] } }) : message.method === "initialize" ? rpc({}) : "";
    return answer(200, reply, { "Mcp-Session-Id": "s1" });
  });

  return {
    fetcher,
    refreshesAsked,
    signInLink: () => `/sign-in/link#access_token=${issue().access_token}&refresh_token=r${issued}&expires_in=${hour / 1000}&token_type=bearer&type=magiclink`,
    endSession: () => refreshTokens.clear(),
    refreshFrom: (to: Refresh) => {
      refresh = to;
    },
    bearersAt: (path: string) => bearers.filter((call) => call.path === path).map((call) => call.bearer),
    bearersAfterwards: (path: string) => {
      const asked = bearers.filter((call) => call.path === path);
      return asked[asked.length - 1]?.bearer;
    },
  };
};

let wakala: ReturnType<typeof wakalaAnswering>;
let start: number;

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const timePasses = (ms: number) => vi.setSystemTime(Date.now() + ms);

const signInAgain = () => screen.queryByRole("heading", { name: words.signInTitle });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  start = Date.now();
  window.localStorage.clear();
  window.sessionStorage.clear();
  forgetOpenAgency();
  forgetSubject();
  resetMcp();
  wakala = wakalaAnswering();
  vi.stubGlobal("fetch", wakala.fetcher);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("journey 21, step 6: a link session that lasts an hour", () => {
  it("is renewed a minute before it ends, keeps what it is given, and still opens after the app was closed", async () => {
    const firstOpening = open(wakala.signInLink());
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(await screen.findByText(siaya.name)).toBeInTheDocument();
    expect(screen.getByText(kisumu.name)).toBeInTheDocument();
    expect(wakala.refreshesAsked).toEqual([]);
    expect(new Set(wakala.bearersAt("/me/agencies"))).toEqual(new Set(["a1"]));

    timePasses(hour - aMinuteToGo);
    await userEvent.click(screen.getByRole("button", { name: words.findAgencyTitle }));
    expect(await screen.findByText(nakuru.name)).toBeInTheDocument();
    expect(wakala.refreshesAsked).toEqual(["r1"]);
    expect(wakala.bearersAfterwards("/directory")).toBe("a2");
    expect(storedToken()).toMatchObject({ accessToken: "a2", refreshToken: "r2" });
    expect(storedToken()?.expiresAt).toBe(Date.now() + hour);

    firstOpening.unmount();
    timePasses(2 * hour);
    open("/agencies");
    expect(await screen.findByText(siaya.name)).toBeInTheDocument();
    expect(signInAgain()).not.toBeInTheDocument();
    expect(wakala.refreshesAsked).toEqual(["r1", "r2"]);
    expect(wakala.bearersAfterwards("/me")).toBe("a3");
    expect(wakala.bearersAfterwards("/me/agencies")).toBe("a3");
    expect(storedToken()).toMatchObject({ accessToken: "a3", refreshToken: "r3" });
    expect(storedToken()?.expiresAt).toBeGreaterThan(start + 3 * hour);
  });

  it("sends her to Sign in with the sentence when the renewal is refused as she opens an agency, and forgets the token", async () => {
    open(wakala.signInLink());
    expect(await screen.findByText(siaya.name)).toBeInTheDocument();

    wakala.endSession();
    timePasses(hour - aMinuteToGo);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(siaya.name) }));

    expect(await screen.findByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
    expect(within(screen.getByRole("alert")).getByText(words.signInSessionEnded)).toBeInTheDocument();
    expect(storedToken()).toBeNull();
    expect(wakala.refreshesAsked).toEqual(["r1"]);
    expect(wakala.bearersAfterwards("/me")).toBeUndefined();
  });

  it("sends her to Sign in with the sentence when she opens the app after the hour and the renewal is refused", async () => {
    const firstOpening = open(wakala.signInLink());
    expect(await screen.findByText(siaya.name)).toBeInTheDocument();

    firstOpening.unmount();
    wakala.endSession();
    timePasses(2 * hour);
    open("/agencies");

    expect(await screen.findByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
    expect(within(screen.getByRole("alert")).getByText(words.signInSessionEnded)).toBeInTheDocument();
    expect(storedToken()).toBeNull();
    expect(wakala.refreshesAsked).toEqual(["r1"]);
    expect(screen.queryByText(siaya.name)).not.toBeInTheDocument();
  });

  it("keeps the token it has when the renewal answers without a new one, and renews on the next try", async () => {
    open(wakala.signInLink());
    expect(await screen.findByText(siaya.name)).toBeInTheDocument();
    const kept = storedToken();

    wakala.refreshFrom("answers nothing");
    timePasses(hour - aMinuteToGo);
    await userEvent.click(screen.getByRole("button", { name: words.findAgencyTitle }));
    expect(await screen.findByText(nakuru.name)).toBeInTheDocument();
    expect(wakala.refreshesAsked).toEqual(["r1"]);
    expect(wakala.bearersAfterwards("/directory")).toBe("a1");
    expect(storedToken()).toEqual(kept);
    expect(signInAgain()).not.toBeInTheDocument();

    wakala.refreshFrom("renews");
    await userEvent.click(screen.getByRole("button", { name: words.findAgencySearch }));
    await screen.findByText(nakuru.name);
    expect(wakala.refreshesAsked).toEqual(["r1", "r1"]);
    expect(wakala.bearersAfterwards("/directory")).toBe("a2");
    expect(storedToken()).toMatchObject({ accessToken: "a2", refreshToken: "r2" });
  });
});
