import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import words from "../../../public/i18n.json";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import { useNoticeState } from "../../shell/useNoticeState";
import type { Hub } from "../../types";
import { NoticeCtx } from "../../ui";
import { AccessKeysPage } from "./AccessKeysPage";

const hub: Hub = { id: "agency-1", name: "Siaya Farmers' Group", role: "owner", kind: "farmers" };

type Held = { id: string; name: string; created_at: string; revoked_at?: string };

const laptop: Held = { id: "k1", name: "laptop", created_at: "2026-06-09T10:00:00Z" };
const desktop: Held = { id: "k2", name: "desktop", created_at: "2026-07-14T10:00:00Z" };
const retired: Held = { id: "k3", name: "old phone", created_at: "2026-01-03T10:00:00Z", revoked_at: "2026-02-01T10:00:00Z" };

type Call = { method: string; url: string; init: RequestInit };

function serve(held: Held[], refusal?: { status: number; error: string }) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ method: String(init.method), url, init });
      const reply = (status: number, body?: unknown) => ({
        ok: status < 400,
        status,
        json: async () => {
          if (body === undefined) throw new SyntaxError("no body");
          return body;
        },
      });
      if (init.method === "GET") return reply(200, held);
      if (init.method === "POST") {
        if (refusal) return reply(refusal.status, { error: refusal.error });
        const name = JSON.parse(String(init.body)).name;
        const made = { id: "k9", name, created_at: "2026-11-16T10:00:00Z", token: "wak_k9.s3cr3t" };
        held.push({ id: made.id, name, created_at: made.created_at });
        return reply(201, made);
      }
      const gone = held.findIndex((key) => url.endsWith("/" + key.id));
      if (gone < 0) return reply(404, { error: "not found" });
      held.splice(gone, 1);
      return reply(204);
    }),
  );
  return calls;
}

function Stage() {
  const notice = useNoticeState(hub.id);
  return (
    <ConsoleCtx.Provider value={{ hub, page: "access-keys", setBadges: () => {}, refreshMenu: () => {} }}>
      <NoticeCtx.Provider value={notice}>
        <AccessKeysPage />
      </NoticeCtx.Provider>
    </ConsoleCtx.Provider>
  );
}

const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 6; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

const open = async () => {
  const person = userEvent.setup();
  render(
    <I18nProvider initial={words}>
      <MemoryRouter initialEntries={["/h/agency-1/access-keys"]}>
        <Stage />
      </MemoryRouter>
    </I18nProvider>,
  );
  await settle();
  return person;
};

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

const makeKey = async (person: ReturnType<typeof userEvent.setup>, name: string) => {
  await person.type(screen.getByRole("textbox", { name: /Name/ }), name);
  await person.click(screen.getByRole("button", { name: "Make key" }));
  await settle();
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Access keys page", () => {
  it("is titled Access keys and lists the signed-in person's keys with the day each was made, leaving out revoked ones", async () => {
    const calls = serve([laptop, desktop, retired]);
    await open();

    expect(screen.getByRole("heading", { level: 1, name: "Access keys" })).toBeInTheDocument();
    expect(calls[0]).toMatchObject({ method: "GET", url: "https://wakala.test/auth/api-keys" });
    expect(calls[0].init.credentials).toBe("include");
    expect(within(rowOf("laptop")).getByText("9 Jun 2026")).toBeInTheDocument();
    expect(within(rowOf("desktop")).getByText("14 Jul 2026")).toBeInTheDocument();
    expect(screen.queryByText("old phone")).not.toBeInTheDocument();
  });

  it("has no last-used, scope or expiry column", async () => {
    serve([laptop]);
    await open();

    expect(screen.getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Name", "Made on", ""]);
  });

  it("makes a key from the Name, shows it once with the git clone line and a Copy button, and lists it", async () => {
    const calls = serve([laptop]);
    const person = await open();
    await makeKey(person, "desktop");

    const made = calls.find((call) => call.method === "POST")!;
    expect(made.url).toBe("https://wakala.test/auth/api-keys");
    expect(made.init.credentials).toBe("include");
    expect(JSON.parse(String(made.init.body))).toEqual({ name: "desktop" });
    expect(screen.getByDisplayValue("wak_k9.s3cr3t")).toBeInTheDocument();
    expect(screen.getByText("git clone https://wakala.test/git/agency-1/<repository>.git")).toBeInTheDocument();
    expect(screen.getByText(/not shown again/i)).toBeInTheDocument();
    expect(rowOf("desktop")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue("");

    await person.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe("wak_k9.s3cr3t");
  });

  it("shows no key when the page is opened again", async () => {
    serve([laptop]);
    const person = await open();
    await makeKey(person, "desktop");
    expect(screen.getByDisplayValue("wak_k9.s3cr3t")).toBeInTheDocument();
    document.body.innerHTML = "";

    await open();

    expect(screen.queryByDisplayValue("wak_k9.s3cr3t")).not.toBeInTheDocument();
  });

  it("asks for a name before making a key", async () => {
    const calls = serve([laptop]);
    const person = await open();

    await person.click(screen.getByRole("button", { name: "Make key" }));
    await settle();

    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("shows the API's reason under the field when it refuses a key", async () => {
    serve([laptop], { status: 409, error: "this account already holds 100 live API keys; revoke one before minting another" });
    const person = await open();
    await makeKey(person, "desktop");

    expect(screen.getByText("this account already holds 100 live API keys; revoke one before minting another")).toBeInTheDocument();
    expect(screen.queryByText(/git clone/)).not.toBeInTheDocument();
  });

  it("revokes a key with DELETE and takes its row off the list", async () => {
    const calls = serve([laptop, desktop]);
    const person = await open();

    await person.click(within(rowOf("laptop")).getByRole("button", { name: "Revoke" }));
    await settle();

    const revoked = calls.find((call) => call.method === "DELETE")!;
    expect(revoked.url).toBe("https://wakala.test/auth/api-keys/k1");
    expect(revoked.init.credentials).toBe("include");
    expect(screen.queryByText("laptop")).not.toBeInTheDocument();
    expect(rowOf("desktop")).toBeInTheDocument();
  });

  it("says so when the keys cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "not signed in" }) })));
    await open();

    expect(screen.getByText("The page could not be loaded.")).toBeInTheDocument();
  });
});
