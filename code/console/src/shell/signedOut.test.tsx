import { render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpiredRedirect } from "../entry/ExpiredRedirect";
import { SignIn } from "../entry/SignIn";
import { I18nProvider } from "../i18n";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { setRuntimeConfig } from "../wakala/config";
import { callTool, resetMcp } from "../wakala/mcp";
import { Frame } from "./Frame";
import { useLoaded } from "./useLoaded";

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const riders: Hub = { id: "boda", name: "Boda Boda Riders", role: "owner", kind: "riders", model_key_set: true };

type Answer = { status: number; text?: string };

let mcpAnswer: Answer = { status: 200 };

function stubWakala() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://console.test").pathname;
      if (path === "/mcp") {
        const { status, text } = mcpAnswer;
        return { ok: status < 400, status, headers: new Headers(), text: async () => text ?? "" };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
}

function ReadsRoles() {
  const { state } = useLoaded(() => callTool(riders.id, "agency_list_roles"), []);
  return state.kind === "ready" ? <h1>Roles loaded</h1> : <h1>Roles reading</h1>;
}

function Seed({ children }: { children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession([riders]);
    setReady(true);
  }, [startSession]);
  return ready ? <>{children}</> : null;
}

const openConsole = () =>
  render(
    <MemoryRouter initialEntries={["/h/boda/roles"]}>
      <I18nProvider initial={words}>
        <SessionProvider>
          <ExpiredRedirect />
          <Seed>
            <Routes>
              <Route path="/login" element={<SignIn />} />
              <Route path="/h/:hubId" element={<Frame />}>
                <Route path="roles" element={<ReadsRoles />} />
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

describe("a signed-in console that wakala stops answering", () => {
  it("sends the person to the sign-in view with a plain line when a page read is refused 401", async () => {
    mcpAnswer = { status: 401, text: "authentication required" };
    openConsole();

    expect(await screen.findByText("You were signed out. Sign in again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Roles reading" })).toBeNull();
  });

  it("says what failed in one plain line when a page read is answered 502", async () => {
    mcpAnswer = { status: 502, text: "gateway down" };
    openConsole();

    const main = await waitFor(() => {
      const found = document.querySelector("main");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    const line = await within(main).findByRole("status");
    expect(line).toHaveTextContent("What failed: wakala answered 502: gateway down");
    expect(screen.queryByText("You were signed out. Sign in again.")).toBeNull();
  });
});
