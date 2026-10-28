import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import { provideEntryClient, type Agency, type DirectoryAgency, type EntryClient, type LinkOutcome } from "./api";
import { words } from "./words";

const amina = "amina@example.com";

const siaya: DirectoryAgency = {
  id: "270e07b7-6b69-55ca-aa30-9441ce138541",
  name: "Siaya Farmers' Group",
  kind: "farmers' group",
  purpose: "A synthetic farmers group.",
  joinMode: "approval",
};

const fake = (over: Partial<EntryClient> = {}): EntryClient => ({
  sendSignInLink: async () => "sent",
  listAgencies: async () => [],
  searchDirectory: async () => [siaya],
  join: async () => "requested",
  ...over,
});

const at = (path: string, client: EntryClient) => {
  provideEntryClient(client);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
};

describe("sign in", () => {
  it("has no tab bar on the form or on the language choice", async () => {
    at("/sign-in", fake());
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.changeLanguage }));
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows the form", () => {
    at("/sign-in", fake());
    expect(screen.getByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(words.signInEmail)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.signInSend })).toBeInTheDocument();
  });

  it("sends the link and keeps the form", async () => {
    const send = vi.fn(async () => "sent" as LinkOutcome);
    at("/sign-in", fake({ sendSignInLink: send }));
    await userEvent.type(screen.getByLabelText(words.signInEmail), amina);
    await userEvent.click(screen.getByRole("button", { name: words.signInSend }));
    expect(await screen.findByText(words.signInSent)).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith(amina, `${window.location.origin}/sign-in/link`);
    expect(screen.getByLabelText(words.signInEmail)).toHaveValue(amina);
  });

  it.each([
    ["invalid", words.signInInvalid],
    ["busy", words.signInBusy],
    ["unavailable", words.signInUnavailable],
    ["offline", words.signInOffline],
  ] as const)("says %s", async (outcome, text) => {
    at("/sign-in", fake({ sendSignInLink: async () => outcome }));
    await userEvent.type(screen.getByLabelText(words.signInEmail), "x");
    await userEvent.click(screen.getByRole("button", { name: words.signInSend }));
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("says the session ended", () => {
    at("/sign-in?ended=1", fake());
    expect(screen.getByRole("alert")).toHaveTextContent(words.signInSessionEnded);
  });

  it("opens the language list and returns", async () => {
    at("/sign-in", fake());
    await userEvent.click(screen.getByRole("button", { name: words.changeLanguage }));
    expect(screen.getByRole("heading", { name: words.selectLanguageTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiswahili" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Deutsch" }));
    expect(screen.getByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
  });
});

describe("your agencies", () => {
  it("lists agencies by name with a lead letter and no id on screen", async () => {
    const riders = { id: "c61e4358-10fd-539b-89f5-a7ccf4e94479", name: "Boda Boda Riders" };
    const list: Agency[] = [{ id: siaya.id, name: siaya.name }, riders];
    const { container } = at("/agencies", fake({ listAgencies: async () => list }));
    expect(await screen.findByText(siaya.name)).toBeInTheDocument();
    expect(screen.queryByText(siaya.id)).toBeNull();
    expect(screen.queryByText(riders.id)).toBeNull();
    expect(Array.from(container.querySelectorAll(".row .lead")).map((el) => el.textContent)).toEqual(["S", "B"]);
  });

  it("lists the agencies found by name and kind with a lead letter and no id on screen", async () => {
    const { container } = at("/agencies", fake());
    await userEvent.click(await screen.findByRole("button", { name: words.findAgencyTitle }));
    const row = await screen.findByRole("button", { name: new RegExp(siaya.name) });
    expect(within(row).getByText(siaya.kind)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(siaya.id))).toBeNull();
    expect(Array.from(container.querySelectorAll(".row .lead")).map((el) => el.textContent)).toEqual(["S"]);
  });

  it("says none yet", async () => {
    at("/agencies", fake());
    expect(await screen.findByText(words.agenciesEmptyTitle)).toBeInTheDocument();
    expect(screen.getByText(words.agenciesEmptyBody)).toBeInTheDocument();
  });

  it("says the list did not load", async () => {
    at("/agencies", fake({ listAgencies: async () => Promise.reject(new Error("down")) }));
    expect(await screen.findByText(words.agenciesUnreached)).toBeInTheDocument();
  });

  it("finds an agency and asks to join", async () => {
    const join = vi.fn(async () => "requested" as const);
    at("/agencies", fake({ join }));
    await userEvent.click(await screen.findByRole("button", { name: words.findAgencyTitle }));
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(siaya.name) }));
    expect(screen.getByText(siaya.purpose)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.agencyAskToJoin }));
    await waitFor(() => expect(screen.getByText(words.agencyRequested)).toBeInTheDocument());
    expect(join).toHaveBeenCalledWith(siaya.id);
  });

  it("reads Join when the agency is open and says joined", async () => {
    at("/agencies", fake({ searchDirectory: async () => [{ ...siaya, joinMode: "open" }], join: async () => "joined" }));
    await userEvent.click(await screen.findByRole("button", { name: words.findAgencyTitle }));
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(siaya.name) }));
    await userEvent.click(screen.getByRole("button", { name: words.agencyJoin }));
    expect(await screen.findByText(words.agencyJoined)).toBeInTheDocument();
  });

  it("says when nothing is found and when the directory fails", async () => {
    at("/agencies", fake({ searchDirectory: async () => [] }));
    await userEvent.click(await screen.findByRole("button", { name: words.findAgencyTitle }));
    expect(await screen.findByText(words.findAgencyNoneTitle)).toBeInTheDocument();
  });

  it("says the directory did not load", async () => {
    at("/agencies", fake({ searchDirectory: async () => Promise.reject(new Error("down")) }));
    await userEvent.click(await screen.findByRole("button", { name: words.findAgencyTitle }));
    expect(await screen.findByText(words.findAgencyUnreached)).toBeInTheDocument();
  });
});
