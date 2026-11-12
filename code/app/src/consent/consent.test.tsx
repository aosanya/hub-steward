import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { endInAgencies, farmers, openApp, startInAgencies, stubWakala, where } from "../journeys/inAgency.test-support";
import { words } from "../entry/words";
import { swahili } from "../entry/swahili";
import { unsettle } from "./settled";

const sheet = "We keep your answers and messages so the council can hear what residents think.";

const published = { version: "v3", language: "en", clauses: [{ key: "consent", text: sheet }] };

const homePath = `/a/${farmers.id}/home`;
const consentPath = `/a/${farmers.id}/consent`;
const doSomethingPath = `/a/${farmers.id}/do-something`;

const neverAgreed = {
  custody_get_my_consent: () => ({ status: "none" }),
  custody_get_in_force_consent: () => published,
  custody_agree_consent: () => ({ id: "c1", mechanics_version_id: "v3" }),
};

beforeEach(() => {
  window.localStorage.clear();
  startInAgencies();
  unsettle(farmers.id);
});

afterEach(endInAgencies);

describe("the Consent screen on first opening a hub", () => {
  it("shows the in-force text with one Agree button and no tab bar before the tabs", async () => {
    stubWakala(neverAgreed);
    openApp(homePath);
    expect(await screen.findByText(sheet)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: words.consentTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.consentAgree })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    expect(where()).toBe(consentPath);
  });

  it("records the agreement for the hub and lands on Do Something", async () => {
    const wakala = stubWakala(neverAgreed);
    openApp(homePath);
    await userEvent.click(await screen.findByRole("button", { name: words.consentAgree }));
    await waitFor(() => expect(where()).toBe(doSomethingPath));
    expect(wakala.named("custody_agree_consent")).toHaveLength(1);
    expect(wakala.named("custody_agree_consent")[0].instance).toBe(farmers.id);
  });

  it("does not ask again once the resident has agreed, wherever they go next", async () => {
    const wakala = stubWakala(neverAgreed);
    openApp(homePath);
    await userEvent.click(await screen.findByRole("button", { name: words.consentAgree }));
    await waitFor(() => expect(where()).toBe(doSomethingPath));
    expect(screen.queryByRole("heading", { name: words.consentTitle })).toBeNull();
    expect(wakala.named("custody_get_my_consent")).toHaveLength(1);
  });

  it("asks again after a withdrawal", async () => {
    stubWakala({ ...neverAgreed, custody_get_my_consent: () => ({ status: "withdrawn" }) });
    openApp(homePath);
    expect(await screen.findByRole("button", { name: words.consentAgree })).toBeInTheDocument();
  });

  it("goes straight to the tabs when the resident has already agreed", async () => {
    const wakala = stubWakala({ ...neverAgreed, custody_get_my_consent: () => ({ status: "agreed" }) });
    openApp(homePath);
    await waitFor(() => expect(wakala.named("custody_get_my_consent")).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument());
    expect(where()).toBe(homePath);
    expect(wakala.named("custody_agree_consent")).toHaveLength(0);
  });

  it("does not stop a resident when no consent text is published yet", async () => {
    stubWakala({ ...neverAgreed, custody_get_in_force_consent: () => ({}) });
    openApp(homePath);
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument());
    expect(where()).toBe(homePath);
  });

  it("says the consent was not recorded when the hub refuses it, and stays on the screen", async () => {
    stubWakala({
      ...neverAgreed,
      custody_agree_consent: () => {
        throw new Error("no mechanics version");
      },
    });
    openApp(homePath);
    await userEvent.click(await screen.findByRole("button", { name: words.consentAgree }));
    expect(await screen.findByRole("alert")).toHaveTextContent(words.consentNotSaved);
    expect(where()).toBe(consentPath);
  });

  it("reads the screen in the chosen language", async () => {
    window.localStorage.setItem("hub.language", "sw");
    stubWakala(neverAgreed);
    openApp(homePath);
    expect(await screen.findByRole("button", { name: swahili.consentAgree })).toBeInTheDocument();
  });
});
