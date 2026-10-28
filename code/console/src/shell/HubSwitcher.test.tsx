import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAccounts, type Account } from "../data/accounts";
import { I18nProvider } from "../i18n";
import type { Hub } from "../types";
import { HubSwitcher } from "./HubSwitcher";

vi.mock("../data/accounts");

const words = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const anAccount = (over: Partial<Account> = {}): Account => ({
  id: "c1",
  name: "Claude",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  modelName: "claude-sonnet-5-5",
  status: "enabled",
  keySet: true,
  lastTestResult: "",
  lastTestedAt: "",
  lastTestPrompt: "",
  lastTestReply: "",
  lastTestMs: null,
  chatEnabled: false,
  chatLabel: "",
  ...over,
});

const lab: Hub = { id: "siaya", name: "Siaya Community Computer Lab", role: "owner", kind: "community computer lab", model_key_set: true };
const farmers: Hub = { id: "kisumu", name: "Kisumu Farmers' Group", role: "owner", kind: "farmers' group" };
const riders: Hub = { id: "nairobi", name: "Nairobi Boda Boda Riders", role: "owner", kind: "boda boda riders' group" };

const hubs = [lab, farmers, riders];

const answers = (byHub: Record<string, boolean | "unreadable">) =>
  vi.mocked(listAccounts).mockImplementation(async (hubId) => {
    if (byHub[hubId] === "unreadable") throw new Error("down");
    return [anAccount({ keySet: byHub[hubId] === true })];
  });

const show = () => {
  const user = userEvent.setup();
  render(
    <I18nProvider initial={words}>
      <MemoryRouter>
        <HubSwitcher hubs={hubs} hub={lab} page="status" />
      </MemoryRouter>
    </I18nProvider>,
  );
  return user;
};

const toggle = () => screen.getByRole("button", { name: /Siaya Community Computer Lab/ });

const open = async () => {
  const user = show();
  await user.click(toggle());
  return user;
};

const row = (name: RegExp) => screen.getByRole("link", { name });

beforeEach(() => {
  vi.mocked(listAccounts).mockReset();
  answers({});
});

describe("the model state of the other hubs in the switcher", () => {
  it("reads Ready for a hub whose models hold a key and Setting up for one whose models hold none", async () => {
    answers({ kisumu: true, nairobi: false });
    await open();

    await waitFor(() => expect(row(/Kisumu Farmers' Group/)).toHaveTextContent("Ready"));
    expect(row(/Nairobi Boda Boda Riders/)).toHaveTextContent("Setting up");
  });

  it("reads the other hubs and not the open one, which the console keeps right itself", async () => {
    answers({ kisumu: true, nairobi: true });
    await open();

    await waitFor(() => expect(row(/Nairobi Boda Boda Riders/)).toHaveTextContent("Ready"));
    expect(vi.mocked(listAccounts).mock.calls).toEqual([["kisumu"], ["nairobi"]]);
  });

  it("reads nothing until the switcher is opened", async () => {
    const user = show();
    expect(listAccounts).not.toHaveBeenCalled();

    await user.click(toggle());

    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(2));
  });

  it("leaves a hub as it is when its models cannot be read", async () => {
    answers({ kisumu: "unreadable", nairobi: true });
    await open();

    await waitFor(() => expect(row(/Nairobi Boda Boda Riders/)).toHaveTextContent("Ready"));
    expect(row(/Kisumu Farmers' Group/)).toHaveTextContent("Setting up");
  });

  it("keeps the open hub as the session holds it", async () => {
    answers({ kisumu: true, nairobi: true });
    await open();

    await waitFor(() => expect(row(/Nairobi Boda Boda Riders/)).toHaveTextContent("Ready"));
    expect(within(document.querySelector(".drop") as HTMLElement).getByRole("link", { name: /Siaya Community Computer Lab/ })).toHaveTextContent("Ready");
  });
});

describe("the switcher as the design draws it", () => {
  it("shows the open hub on a compact button with its state and kind, and no panel until it is pressed", async () => {
    const user = show();

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveTextContent("Ready");
    expect(within(toggle()).getByText("Lab", { selector: ".tag" })).toBeInTheDocument();
    expect(document.querySelector(".drop")).toBeNull();

    await user.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector(".drop")).not.toBeNull();
  });

  it("lists Your hubs, each with its kind, an Open on the others and a tick on the open one", async () => {
    await open();
    const panel = within(document.querySelector(".drop") as HTMLElement);

    expect(panel.getByText("Your hubs")).toBeInTheDocument();
    expect(panel.getByRole("searchbox", { name: "Find a hub" })).toBeInTheDocument();
    expect(within(panel.getByRole("link", { name: /Kisumu Farmers' Group/ })).getByText("Farmers", { selector: ".tag" })).toBeInTheDocument();
    expect(within(panel.getByRole("link", { name: /Nairobi Boda Boda Riders/ })).getByText("Riders", { selector: ".tag" })).toBeInTheDocument();
    expect(panel.getByRole("link", { name: /Kisumu Farmers' Group/ })).toHaveTextContent("Open");
    expect(panel.getByRole("link", { name: /Siaya Community Computer Lab/ })).toHaveAttribute("aria-current", "true");
    expect(panel.getByRole("link", { name: /Siaya Community Computer Lab/ })).not.toHaveTextContent("Open");
  });

  it("links Open to the other hub's page and New hub to the create page", async () => {
    await open();

    expect(row(/Kisumu Farmers' Group/)).toHaveAttribute("href", "/h/kisumu/status");
    expect(screen.getByRole("link", { name: "New hub" })).toHaveAttribute("href", "/create");
  });

  it("narrows the list to the hubs the search names and keeps the open hub in it", async () => {
    const user = await open();

    await user.type(screen.getByRole("searchbox", { name: "Find a hub" }), "boda");

    expect(row(/Nairobi Boda Boda Riders/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Kisumu Farmers' Group/ })).toBeNull();
    expect(row(/Siaya Community Computer Lab/)).toBeInTheDocument();
  });

  it("closes the panel on Escape and when a hub is chosen", async () => {
    const user = await open();
    await user.keyboard("{Escape}");
    expect(document.querySelector(".drop")).toBeNull();

    await user.click(toggle());
    await user.click(row(/Kisumu Farmers' Group/));
    expect(document.querySelector(".drop")).toBeNull();
  });
});
