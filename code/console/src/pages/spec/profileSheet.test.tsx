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

const open = (state?: unknown) =>
  render(
    <I18nProvider initial={words}>
      <NoticeCtx.Provider value={{ message: null, show: () => {}, dismiss: () => {} }}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[{ pathname: "/", state }]}>
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

describe("the Profile sheet", () => {
  it("shows the hub's name, purpose and agency id", () => {
    open();

    expect(screen.getByLabelText("Name")).toHaveValue("Siaya Farmers");
    expect(screen.getByLabelText("Purpose")).toHaveValue("Share seed and tools");
    expect(screen.getByText("agency-9")).toBeInTheDocument();
  });

  it("sends nothing when Save changes is pressed with no edit", async () => {
    const run = vi.fn(async () => "done");
    profileWith(run);
    open();

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(run).not.toHaveBeenCalled();
  });

  it("sends the name and the purpose as the description and says when it was saved", async () => {
    const run = vi.fn(async () => "done");
    profileWith(run);
    open();

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Siaya Growers");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(run).toHaveBeenCalledWith("h1", { name: "Siaya Growers", description: "Share seed and tools" }));
    expect(await screen.findByText(/Last saved/)).toBeInTheDocument();
    expect(screen.queryByText("The change could not be sent.")).not.toBeInTheDocument();
  });

  it("asks for a name when the name is emptied and sends nothing", async () => {
    const run = vi.fn(async () => "done");
    profileWith(run);
    open();

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: Name");
    expect(run).not.toHaveBeenCalled();
  });

  it("says the change could not be sent when the hub refuses it, and keeps the typed text", async () => {
    profileWith(
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    open();

    await userEvent.type(screen.getByLabelText("Purpose"), " and water");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(screen.getByLabelText("Purpose")).toHaveValue("Share seed and tools and water");
  });

  it("starts from what Chat filled in, ahead of the saved profile", () => {
    open({ chatFill: { form: "profile", fill: { name: "Siaya Growers", purpose: "Grow maize together" } } });

    expect(screen.getByLabelText("Name")).toHaveValue("Siaya Growers");
    expect(screen.getByLabelText("Purpose")).toHaveValue("Grow maize together");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("saves by itself after a pause when Autosave is on, and shows no Save changes button", async () => {
    localStorage.setItem("autosave", "on");
    const run = vi.fn(async (_hub: string, _values: Record<string, unknown>) => "done");
    profileWith(run);
    open();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Purpose"), "!");

    await waitFor(() => expect(run).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(run.mock.calls[0][1]).toEqual({ name: "Siaya Farmers", description: "Share seed and tools!" });
  });

  it("does not send the same refused text again by itself while Autosave is on", async () => {
    localStorage.setItem("autosave", "on");
    const run = vi.fn(async () => {
      throw new Error("offline");
    });
    profileWith(run);
    open();

    await userEvent.type(screen.getByLabelText("Purpose"), "!");
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await new Promise((done) => setTimeout(done, 1800));

    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByText("The change could not be sent.")).toBeInTheDocument();
  });
});
