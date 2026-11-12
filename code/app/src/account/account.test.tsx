import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { forgetOpenAgency, openAgency, openAgencyId } from "../agency/open";
import { words } from "../entry/words";
import { swahili } from "../entry/swahili";
import * as mcp from "../wakala/mcp";
import { LanguagePage } from "./LanguagePage";
import { ProfilePage } from "./ProfilePage";
import { SignOutPage } from "./SignOutPage";

const akinyi = { id: "m1", display_name: "Akinyi Otieno", public_code: "M-K7P-4QX-M2T", attributes: { phone: "+254 700 000 000" } };

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

const stubActor = (correct?: (args: Record<string, unknown>) => unknown) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, tool: string, args: Record<string, unknown> = {}) => {
    if (tool === "actor_get_my_actor") return akinyi;
    if (tool === "actor_correct_my_attributes" && correct) return correct(args);
    throw new Error("down");
  });

const opened = (path: string) =>
  render(
    <MemoryRouter initialEntries={["/start", path]} initialIndex={1}>
      <Routes>
        <Route path="/start" element={<p>start</p>} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/language" element={<LanguagePage />} />
        <Route path="/sign-out" element={<SignOutPage />} />
        <Route path="/sign-in" element={<p>sign in screen</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  window.localStorage.clear();
  openAgency("walk-agency");
});

afterEach(() => {
  forgetOpenAgency();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("My profile", () => {
  it("shows the resident's own record with the phone number to correct", async () => {
    stubActor();
    opened("/profile");
    expect(await screen.findByText("Akinyi Otieno")).toBeInTheDocument();
    expect(screen.getByText("M-K7P-4QX-M2T")).toBeInTheDocument();
    expect(screen.getByLabelText(words.profilePhone)).toHaveValue("+254 700 000 000");
  });

  it("saves a corrected phone number through the self-correction tool and says so", async () => {
    const spy = stubActor((args) => ({ ...akinyi, attributes: args.attributes }));
    opened("/profile");
    const field = await screen.findByLabelText(words.profilePhone);
    await userEvent.clear(field);
    await userEvent.type(field, "+254 711 000 000");
    await userEvent.click(screen.getByRole("button", { name: words.profileSave }));
    expect(await screen.findByRole("status")).toHaveTextContent(words.profileSaved);
    expect(spy).toHaveBeenCalledWith("", "actor_correct_my_attributes", { attributes: { phone: "+254 711 000 000" } });
    expect(field).toHaveValue("+254 711 000 000");
  });

  it("says the number was not saved when the hub refuses it, and drops the saved line on the next edit", async () => {
    stubActor(() => {
      throw new Error("phone already held");
    });
    opened("/profile");
    const field = await screen.findByLabelText(words.profilePhone);
    await userEvent.click(screen.getByRole("button", { name: words.profileSave }));
    expect(await screen.findByText(words.profileNotSaved)).toBeInTheDocument();
    await userEvent.type(field, "1");
    expect(screen.queryByText(words.profileNotSaved)).toBeNull();
  });

  it("says the profile did not load when the hub cannot be reached", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("down"));
    opened("/profile");
    expect(await screen.findByRole("alert")).toHaveTextContent(words.profileUnreached);
  });

  it("goes back to the screen it was opened from", async () => {
    stubActor();
    opened("/profile");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/start");
  });
});

describe("Change language", () => {
  it("changes the words, keeps the choice and goes back", async () => {
    opened("/language");
    expect(screen.getByRole("heading", { name: words.changeLanguage })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Kiswahili" }));
    expect(window.localStorage.getItem("hub.language")).toBe("sw");
    expect(screen.getByTestId("where")).toHaveTextContent("/start");
  });

  it("shows the screen in the chosen language afterwards", async () => {
    window.localStorage.setItem("hub.language", "sw");
    stubActor();
    opened("/profile");
    expect(await screen.findByLabelText(swahili.profilePhone)).toBeInTheDocument();
  });
});

describe("Sign out", () => {
  it("names who is signed in, ends the session on the hub and the phone, and opens Sign in", async () => {
    stubActor();
    const posted = vi.fn(async () => ({ ok: true, status: 204 }));
    vi.stubGlobal("fetch", posted);
    window.localStorage.setItem("hubsteward.token", JSON.stringify({ accessToken: "t", expiresAt: null, refreshToken: null }));
    opened("/sign-out");
    expect(await screen.findByText("You are signed in as Akinyi Otieno.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.signOutTitle }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/sign-in"));
    expect(posted).toHaveBeenCalledWith("https://wakala.test/auth/signout", expect.objectContaining({ method: "POST" }));
    expect(window.localStorage.getItem("hubsteward.token")).toBeNull();
    expect(openAgencyId()).toBe("");
  });

  it("still signs out on this phone when the hub cannot be reached", async () => {
    stubActor();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    opened("/sign-out");
    await userEvent.click(await screen.findByRole("button", { name: words.signOutTitle }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/sign-in"));
  });
});

describe("the drawer entries", () => {
  it.each([
    ["/profile", words.profileTitle],
    ["/language", words.changeLanguage],
    ["/sign-out", words.signOutTitle],
  ])("open their own screen at %s inside the app", async (path, title) => {
    stubActor();
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Home" })).toBeNull();
  });
});
