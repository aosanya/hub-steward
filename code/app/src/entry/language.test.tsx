import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach } from "vitest";
import { App } from "../App";
import { provideEntryClient, type EntryClient } from "./api";
import { wordsFor } from "./language";
import { magyar } from "./magyar";
import { swahili } from "./swahili";
import { words } from "./words";

const mount = (path = "/sign-in") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const chooseKiswahili = async () => {
  await userEvent.click(screen.getByRole("button", { name: words.changeLanguage }));
  await userEvent.click(screen.getByRole("button", { name: "Kiswahili" }));
};

describe("choosing a language", () => {
  beforeEach(() => {
    window.localStorage.clear();
    provideEntryClient({
      sendSignInLink: async () => "sent",
      listAgencies: async () => [],
      searchDirectory: async () => [],
      join: async () => "joined",
    } as EntryClient);
  });

  it("shows Sign in in Kiswahili after choosing Kiswahili", async () => {
    mount();
    await chooseKiswahili();
    expect(screen.getByRole("heading", { name: swahili.signInTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(swahili.signInEmail)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: swahili.signInSend })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: swahili.changeLanguage })).toBeInTheDocument();
  });

  it("keeps the choice on the phone and survives a reload", async () => {
    const first = mount();
    await chooseKiswahili();
    first.unmount();
    expect(window.localStorage.getItem("hub.language")).toBe("sw");
    mount();
    expect(screen.getByRole("heading", { name: swahili.signInTitle })).toBeInTheDocument();
  });

  it("lists the languages in Kiswahili once chosen", async () => {
    mount();
    await chooseKiswahili();
    await userEvent.click(screen.getByRole("button", { name: swahili.changeLanguage }));
    expect(screen.getByRole("heading", { name: swahili.selectLanguageTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiswahili" })).toHaveAttribute("aria-pressed", "true");
  });

  it("speaks Kiswahili on Your agencies too", async () => {
    window.localStorage.setItem("hub.language", "sw");
    mount("/agencies");
    expect(await screen.findByText(swahili.agenciesEmptyTitle)).toBeInTheDocument();
  });

  it("returns to English by choosing English", async () => {
    window.localStorage.setItem("hub.language", "sw");
    mount();
    await userEvent.click(screen.getByRole("button", { name: swahili.changeLanguage }));
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
  });

  it("falls back to English for a language not yet translated", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: words.changeLanguage }));
    await userEvent.click(screen.getByRole("button", { name: "Deutsch" }));
    expect(screen.getByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
    expect(wordsFor("de")).toBe(words);
  });

  it("still works when the phone refuses storage", async () => {
    const refuse = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount();
    await chooseKiswahili();
    expect(screen.getByRole("heading", { name: swahili.signInTitle })).toBeInTheDocument();
    refuse.mockRestore();
    set.mockRestore();
  });

  it("shows Sign in in Hungarian after choosing Magyar and keeps the choice", async () => {
    const first = mount();
    await userEvent.click(screen.getByRole("button", { name: words.changeLanguage }));
    await userEvent.click(screen.getByRole("button", { name: "Magyar" }));
    expect(screen.getByRole("heading", { name: magyar.signInTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(magyar.signInEmail)).toBeInTheDocument();
    first.unmount();
    expect(window.localStorage.getItem("hub.language")).toBe("hu");
    mount();
    expect(screen.getByRole("heading", { name: magyar.signInTitle })).toBeInTheDocument();
    expect(wordsFor("hu")).toBe(magyar);
  });

  it("has a Hungarian word for every English word", () => {
    expect(Object.keys(magyar).sort()).toEqual(Object.keys(words).sort());
    Object.values(magyar).forEach((w) => expect(w.length).toBeGreaterThan(0));
  });

  it("has a Kiswahili word for every English word", () => {
    expect(Object.keys(swahili).sort()).toEqual(Object.keys(words).sort());
    Object.values(swahili).forEach((w) => expect(w.length).toBeGreaterThan(0));
  });
});
