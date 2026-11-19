import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "../../app/App";
import { forgetOpenAgency } from "../../shared/wakala/openAgency";
import { words } from "../../shared/language/words";
import { provideEntryClient, type DirectoryAgency, type EntryClient } from "./api";

const siaya: DirectoryAgency = {
  id: "270e07b7-6b69-55ca-aa30-9441ce138541",
  name: "Siaya Farmers' Group",
  kind: "farmers' group",
  purpose: "A synthetic farmers group.",
  joinMode: "approval",
};

const client: EntryClient = {
  sendSignInLink: async () => "sent",
  listAgencies: async () => [],
  searchDirectory: async () => [siaya],
  join: async () => "requested",
};

const at = (path: string) => {
  provideEntryClient(client);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
};

const back = () => userEvent.click(document.querySelector(".back") as HTMLElement);

beforeEach(() => forgetOpenAgency());

afterEach(cleanup);

describe("the in-page Back of the sign-in and agencies pages", () => {
  it("the language choice on the sign-in page goes back to the sign-in form", async () => {
    at("/sign-in");
    await userEvent.click(screen.getByRole("button", { name: words.changeLanguage }));
    expect(await screen.findByRole("heading", { name: words.selectLanguageTitle })).toBeInTheDocument();

    await back();

    expect(await screen.findByRole("heading", { name: words.signInTitle })).toBeInTheDocument();
  });

  it("an agency found in the directory goes back to the search, and the search back to the list", async () => {
    at("/agencies");
    await userEvent.click(await screen.findByRole("button", { name: words.findAgencyTitle }));
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(siaya.name) }));
    expect(await screen.findByRole("heading", { name: siaya.name })).toBeInTheDocument();

    await back();

    expect(await screen.findByRole("heading", { name: words.findAgencyTitle })).toBeInTheDocument();

    await back();

    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
  });
});
