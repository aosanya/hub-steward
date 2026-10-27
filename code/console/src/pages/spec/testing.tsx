import { render } from "@testing-library/react";
import { Link, MemoryRouter, Outlet, Route, Routes, useParams } from "react-router-dom";
import { vi } from "vitest";
import { hubPath } from "../../api";
import type { ActionRun, Query } from "../../data/types";
import { I18nProvider } from "../../i18n";
import { ConsoleCtx } from "../../shell/context";
import type { PageColumn, PageRow } from "../../types";
import { SpecPage } from "../SpecPage";
import { clearPages, pages } from "./fakeRegistry";

export { clearPages, pages };

export const english = {
  en: {
    "menu.alerts": "Alerts",
    planned: "This page is planned.",
    noRows: "Nothing here yet.",
    loadFailed: "The page could not be loaded.",
    agentEdit: "Edit",
    joinOpen: "Open to join",
    joinRequireApproval: "Require approval",
    joinOpenToAnyone: "Open to anyone",
    waitingForApproval: "Waiting for approval",
    submitFailed: "The change could not be sent.",
    setDefaultLanguage: "Default language",
    renameHub: "Rename the hub",
    addObjective: "Add an objective",
    submit: "Submit",
    cancel: "Cancel",
    required: "Required",
    "field.group_id": "Group",
    "field.goal_id": "Goal",
    "field.language": "Language",
    "field.actor_id": "Person",
    "field.actor_code": "Member code",
    "field.name": "Name",
    "field.title": "Title",
    "field.description": "Description",
    "field.purpose": "Purpose",
    "field.join_mode": "Joining",
    "field.text": "Text",
  },
};

export type RowsRun = (hubId: string, query: Query) => Promise<PageRow[]>;

export type PageSetup = {
  title?: string;
  primary?: string;
  columns?: PageColumn[];
  rows?: PageRow[] | RowsRun;
  actions?: Record<string, ActionRun>;
};

export function installPage(id: string, setup: PageSetup = {}) {
  const source = setup.rows ?? [];
  const rows = vi.fn<RowsRun>(async (hubId, query) => (typeof source === "function" ? source(hubId, query) : source));
  pages[id] = {
    spec: { id, title: setup.title ?? id, primary: setup.primary ?? "", tools: [], columns: setup.columns ?? [] },
    rows,
    actions: setup.actions,
  };
  return rows;
}

export const answering = (result: "done" | "accepted") => vi.fn<ActionRun>(async () => result);

export const failing = () =>
  vi.fn<ActionRun>(async () => {
    throw new Error("offline");
  });

export const hubRow = { id: "h1", name: "Siaya Boda Boda Riders", role: "owner", model_key_set: true, manager_room_id: "room-m" };

function Frame() {
  const { page } = useParams();
  return (
    <ConsoleCtx.Provider value={{ hub: hubRow, page: page ?? "", setBadges: () => {}, refreshMenu: () => {} }}>
      <Link to={hubPath(hubRow.id, "roles")}>Go to roles</Link>
      <Outlet />
    </ConsoleCtx.Provider>
  );
}

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

export function renderSpecPage(page: string) {
  render(
    <I18nProvider initial={english}>
      <MemoryRouter future={routerFuture} initialEntries={[hubPath(hubRow.id, page)]}>
        <Routes>
          <Route path="/h/:hubId" element={<Frame />}>
            <Route path="agent-edit/:role/:tab" element={<p>Agent edit page</p>} />
            <Route path=":page" element={<SpecPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}
