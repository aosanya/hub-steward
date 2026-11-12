import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { provideEntryClient, type Agency, type DirectoryAgency, type EntryClient } from "./api";
import { provideWaitingCount, restoreWaitingCount } from "./waiting";
import { words } from "./words";

const farmers: Agency = { id: "270e07b7-6b69-55ca-aa30-9441ce138541", name: "Siaya Farmers' Group" };
const riders: Agency = { id: "c61e4358-10fd-539b-89f5-a7ccf4e94479", name: "Siaya Boda Boda Riders" };
const listed: DirectoryAgency = { id: "d1", name: "Kisumu Growers", kind: "cooperative", purpose: "Sell grain together", joinMode: "open" };

const mount = (path: string, agencies: Agency[] = [farmers, riders]) => {
  provideEntryClient({
    sendSignInLink: async () => "sent",
    listAgencies: async () => agencies,
    searchDirectory: async () => [listed],
    join: async () => "joined",
  } as EntryClient);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
};

const bar = () => screen.getByRole("banner");
const menuIn = (element: HTMLElement) => within(element).queryByRole("button", { name: "Menu" });

describe("the Menu button on the entry screens", () => {
  beforeEach(() => {
    window.localStorage.clear();
    provideWaitingCount(async () => 0);
  });
  afterEach(() => restoreWaitingCount());

  it("is absent from Sign in, a tabless root screen with no back link", () => {
    mount("/sign-in");
    expect(screen.getByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
    expect(menuIn(bar())).toBeNull();
  });

  it("is on the language list, which has a back link, and opens the drawer without a tab bar", async () => {
    mount("/sign-in");
    await userEvent.click(screen.getByRole("button", { name: words.changeLanguage }));
    expect(within(bar()).getByRole("button", { name: "Back" })).toBeInTheDocument();
    await userEvent.click(menuIn(bar())!);
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem")).toHaveLength(5);
    expect((screen.getByRole("main").closest(".page") as HTMLElement).classList.contains("open")).toBe(true);
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  });

  it("is absent from Your agencies, a tabless root screen with no back link", async () => {
    mount("/agencies");
    expect(await screen.findByText(farmers.name)).toBeInTheDocument();
    expect(menuIn(bar())).toBeNull();
  });

  it("is on Find an agency, which has a back link", async () => {
    mount("/agencies");
    await userEvent.click(await screen.findByRole("button", { name: words.findAgencyTitle }));
    expect(await screen.findByText(listed.name)).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(menuIn(bar())).not.toBeNull();
  });

  it("is on the agency's own page, which has a back link", async () => {
    mount("/agencies");
    await userEvent.click(await screen.findByRole("button", { name: words.findAgencyTitle }));
    await userEvent.click(await screen.findByText(listed.name));
    expect(await screen.findByText(listed.purpose)).toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(menuIn(bar())).not.toBeNull();
  });
});
