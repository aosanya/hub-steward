import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { setRuntimeConfig } from "../wakala/config";
import { resetMcp } from "../wakala/mcp";
import { Frame } from "./Frame";

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const municipality: Hub = {
  id: "m1",
  name: "Municipality",
  role: "resident",
  kind: "municipality",
  permissions: ["consent.publish"],
};

const siaya: Hub = { id: "h1", name: "Siaya Farmers", role: "owner", kind: "farmers", model_key_set: true };

let reached: string[] = [];

function stubWakala() {
  reached = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      reached.push(new URL(String(input), "http://console.test").pathname);
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}), text: async () => "" };
    }),
  );
}

function Seed({ children }: { children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession([municipality, siaya]);
    setReady(true);
  }, [startSession]);
  return ready ? <>{children}</> : null;
}

const openConsole = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          <Seed>
            <Routes>
              <Route path="/h/:hubId" element={<Frame />}>
                <Route path="consent" element={<h1>Consent text page</h1>} />
                <Route path=":page" element={<h1>Some other page</h1>} />
              </Route>
            </Routes>
          </Seed>
        </SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  resetMcp();
  setRuntimeConfig({ wakala: "", mcp: "/mcp" });
  stubWakala();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the console of a resident who holds consent.publish", () => {
  it("opens the Consent text page with Settings > Consent text as the only menu row", async () => {
    openConsole("/h/m1/consent");

    expect(await screen.findByRole("heading", { name: "Consent text page" })).toBeInTheDocument();
    const menu = screen.getByRole("navigation", { name: words.en.menuLabel });
    expect(menu.querySelector('a[aria-current="page"]')).toHaveTextContent(words.en["menu.consent"]);
    expect(menu.querySelectorAll("a.nav-link")).toHaveLength(2);
  });

  it("sends a page they may not open to the Consent text page without loading it", async () => {
    openConsole("/h/m1/roles");

    expect(await screen.findByRole("heading", { name: "Consent text page" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Some other page" })).toBeNull();
  });

  it("calls nothing at mount and shows no chat column or failure line", async () => {
    openConsole("/h/m1/consent");

    await screen.findByRole("heading", { name: "Consent text page" });
    await waitFor(() => expect(screen.queryByText(/What failed/)).toBeNull());
    expect(reached).toEqual([]);
    expect(document.querySelector(".chat")).toBeNull();
  });

  it("leaves an owner's page alone", async () => {
    openConsole("/h/h1/roles");

    expect(await screen.findByRole("heading", { name: "Some other page" })).toBeInTheDocument();
    expect(document.querySelector(".chat")).not.toBeNull();
  });
});
