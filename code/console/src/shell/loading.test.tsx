import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { SessionProvider, useSession } from "../session";
import type { Hub } from "../types";
import { Loading } from "../ui";
import { McpError, callTool } from "../wakala/mcp";
import { Frame } from "./Frame";
import { LoadingCtx, useReportLoading } from "./loadingContext";
import { useLoaded } from "./useLoaded";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const lab: Hub = { id: "siaya", name: "Siaya Community Computer Lab", role: "owner", kind: "community computer lab", model_key_set: true };

const listTools = ["agency_list_approvals"];

let finishSlowPage: (heading: string) => void = () => {};

function SlowPage() {
  const { state: loaded } = useLoaded(() => new Promise<string>((resolveLoad) => (finishSlowPage = resolveLoad)), []);
  return loaded.kind === "ready" ? <h1>{loaded.value}</h1> : null;
}

function QuickPage() {
  return <h1>Quick page</h1>;
}

function Seed({ children }: { children: ReactNode }) {
  const { startSession } = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startSession([lab]);
    setReady(true);
  }, [startSession]);
  return ready ? <>{children}</> : null;
}

function stubBackend(sessionAnswer: () => Promise<unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://console.test").pathname;
      if (path === "/auth/session") return sessionAnswer();
      return { ok: true, status: 200, json: async () => [] };
    }),
  );
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (_hubId: string, tool: string) => {
    if (listTools.includes(tool)) return { items: [] } as never;
    throw new McpError(`unexpected tool ${tool}`);
  });
}

function openConsole(at: string, { signedIn = true } = {}) {
  const routes = (
    <Routes>
      <Route path="/login" element={<p>sign-in page</p>} />
      <Route path="/h/:hubId" element={<Frame />}>
        <Route path="slow" element={<SlowPage />} />
        <Route path="quick" element={<QuickPage />} />
      </Route>
    </Routes>
  );
  return render(
    <MemoryRouter initialEntries={[at]}>
      <I18nProvider initial={words}>
        <SessionProvider>{signedIn ? <Seed>{routes}</Seed> : routes}</SessionProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

const spinnerInPage = () => document.querySelector("main .loading");

beforeEach(() => {
  stubBackend(async () => ({ ok: true, status: 200, json: async () => ({ member_id: "m-1" }) }));
});

describe("the loading animation", () => {
  it("shows the spinner with a spoken Loading label", () => {
    render(
      <I18nProvider initial={words}>
        <Loading />
      </I18nProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("is said in the language the console is set to", () => {
    localStorage.setItem("lang", "de");
    render(
      <I18nProvider initial={words}>
        <Loading />
      </I18nProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Wird geladen");
    localStorage.removeItem("lang");
  });

  it("is reported by a page while it loads and withdrawn when it stops", () => {
    const report = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => <LoadingCtx.Provider value={report}>{children}</LoadingCtx.Provider>;
    const { rerender } = renderHook(({ loading }) => useReportLoading(loading), { wrapper, initialProps: { loading: true } });
    expect(report.mock.calls).toEqual([[1]]);
    rerender({ loading: false });
    expect(report.mock.calls).toEqual([[1], [-1]]);
  });

  it("is withdrawn when the page that was loading goes away", () => {
    const report = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => <LoadingCtx.Provider value={report}>{children}</LoadingCtx.Provider>;
    const { unmount } = renderHook(() => useReportLoading(true), { wrapper });
    unmount();
    expect(report.mock.calls).toEqual([[1], [-1]]);
  });

  it("is reported by nothing when the page is not inside the console", () => {
    expect(() => renderHook(() => useReportLoading(true))).not.toThrow();
  });

  it("spins in the page area while a page loads and goes away when the page has loaded", async () => {
    openConsole("/h/siaya/slow");
    await waitFor(() => expect(spinnerInPage()).not.toBeNull());
    expect(screen.queryByRole("heading", { name: "Slow page" })).toBeNull();

    act(() => finishSlowPage("Slow page"));

    await screen.findByRole("heading", { name: "Slow page" });
    expect(spinnerInPage()).toBeNull();
  });

  it("does not spin on a page that has nothing to load", async () => {
    openConsole("/h/siaya/quick");
    await screen.findByRole("heading", { name: "Quick page" });
    expect(spinnerInPage()).toBeNull();
  });

  it("spins while the saved sign-in is being restored", async () => {
    stubBackend(() => new Promise(() => {}));
    openConsole("/h/siaya/quick", { signedIn: false });
    expect(await screen.findByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByText("sign-in page")).toBeNull();
  });
});
