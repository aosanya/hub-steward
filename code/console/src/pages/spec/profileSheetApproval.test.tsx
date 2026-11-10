import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { NoticeCtx } from "../../ui";
import { ProfileSheet } from "./profileSheet";
import { clearPages, installPage, words } from "./specHarness.test-helper";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

const row = { id: "agency-9", name: "Siaya Farmers", purpose: "Share seed and tools" };

const reload = vi.fn();

const open = () =>
  render(
    <I18nProvider initial={words}>
      <NoticeCtx.Provider value={{ message: null, show: () => {}, dismiss: () => {} }}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ProfileSheet hubId="h1" row={row} reload={reload} />
        </MemoryRouter>
      </NoticeCtx.Provider>
    </I18nProvider>,
  );

const profileWith = (run: ReturnType<typeof vi.fn>) => installPage("profile", { actions: { profile: run as never } });

beforeEach(() => {
  clearPages();
  reload.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the Profile sheet when a change must be approved", () => {
  it("says the change is waiting for approval and does not say Last saved", async () => {
    profileWith(vi.fn(async () => "accepted"));
    open();

    await userEvent.type(screen.getByLabelText("Purpose"), " and water");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.queryByText(/Last saved/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Purpose")).toHaveValue("Share seed and tools and water");
  });

  it("does not send the same waiting text again by itself while Autosave is on", async () => {
    localStorage.setItem("autosave", "on");
    const run = vi.fn(async () => "accepted");
    profileWith(run);
    open();

    await userEvent.type(screen.getByLabelText("Purpose"), "!");
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await new Promise((done) => setTimeout(done, 1800));

    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.queryByText(/Last saved/)).not.toBeInTheDocument();
  });

  it("says Last saved and drops the waiting note once a later save goes through", async () => {
    const run = vi.fn(async () => "accepted");
    profileWith(run);
    open();

    await userEvent.type(screen.getByLabelText("Purpose"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();

    run.mockImplementation(async () => "done");
    await userEvent.type(screen.getByLabelText("Purpose"), "?");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/Last saved/)).toBeInTheDocument();
    expect(screen.queryByText("Waiting for approval")).not.toBeInTheDocument();
  });
});
