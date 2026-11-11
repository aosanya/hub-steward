import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeReferences, fakeRepos, openIssue, reference } from "./referenceFixtures";

const section = async () => (await screen.findByText("References")).closest("section") as HTMLElement;

describe("the References section of an issue's page", () => {
  it("sits in the sections column under the description and above the Log", async () => {
    openIssue(fakeReferences());
    await section();
    const side = document.querySelector(".issue-wide > .issue-side") as HTMLElement;
    const titles = Array.from(side.querySelectorAll(".card-title")).map((one) => one.textContent);
    expect(titles.indexOf("References")).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf("References")).toBeLessThan(titles.indexOf("Log"));
  });

  it("says Nothing referenced yet. above an Add a reference button that opens the add page", async () => {
    openIssue(fakeReferences());
    const card = await section();
    expect(await within(card).findByText("Nothing referenced yet.")).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("link", { name: "Add a reference" }));
    expect(screen.getByTestId("here")).toHaveTextContent("/a/hub-1/backlogs/issue/1/references/add");
  });

  it("shows what each entry points at, its repo and kind, and who named it", async () => {
    openIssue(
      fakeReferences([
        reference({ id: "a", target: "app/main.tsx" }),
        reference({ id: "b", kind: "folder", repo: "hub-steward-swe", target: "loader", source: "assistant", confirmed: false }),
        reference({ id: "c", kind: "issue", repo: "", target: "HS-005" }),
        reference({ id: "d", kind: "screen", repo: "", target: "agency_list_mounts" }),
        reference({ id: "e", kind: "link", repo: "", target: "https://example.test/spec" }),
      ]),
    );
    const card = await section();
    const file = within(card).getByText("app/main.tsx").closest(".refrow") as HTMLElement;
    expect(within(file).getByText("hub-steward · File")).toBeInTheDocument();
    expect(within(file).getByText("Person")).toBeInTheDocument();
    const folder = within(card).getByText("loader").closest(".refrow") as HTMLElement;
    expect(within(folder).getByText("hub-steward-swe · Folder")).toBeInTheDocument();
    expect(within(folder).getByText("Assistant proposed")).toBeInTheDocument();
    expect(within(card).getByText("Board row")).toBeInTheDocument();
    expect(within(card).getByText("Screen or tool")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /https:\/\/example.test\/spec/ })).toHaveAttribute("href", "https://example.test/spec");
  });

  it("gives an unconfirmed assistant entry a Confirm button that becomes Confirmed and keeps the mark", async () => {
    const client = fakeReferences([reference({ id: "p", target: "loader/report.go", source: "assistant", confirmed: false })]);
    openIssue(client);
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Confirm" }));
    expect(client.confirm).toHaveBeenCalledWith("1", "p");
    const row = (await within(card).findByText("Confirmed")).closest(".refrow") as HTMLElement;
    expect(within(row).getByText("Assistant proposed")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Confirm" })).toBeNull();
  });

  it("offers no Confirm on a person's entry", async () => {
    openIssue(fakeReferences([reference({})]));
    const card = await section();
    await within(card).findByText("app/main.tsx");
    expect(within(card).queryByRole("button", { name: "Confirm" })).toBeNull();
    expect(within(card).queryByText("Confirmed")).toBeNull();
  });

  it("removes an entry with its cross and no other", async () => {
    const client = fakeReferences([reference({ id: "a", target: "one.go" }), reference({ id: "b", target: "two.go" })]);
    openIssue(client);
    const card = await section();
    const row = (await within(card).findByText("one.go")).closest(".refrow") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Remove" }));
    expect(client.remove).toHaveBeenCalledWith("1", "a");
    await waitFor(() => expect(within(card).queryByText("one.go")).toBeNull());
    expect(within(card).getByText("two.go")).toBeInTheDocument();
  });

  it("marks a file that is no longer on the repo as Not found and strikes it through", async () => {
    const client = fakeReferences([
      reference({ id: "gone", repo: "hub-steward-swe", target: "documentation/old-page.md" }),
      reference({ id: "here", repo: "hub-steward-swe", target: "documentation/intro.md" }),
    ]);
    openIssue(client, fakeRepos());
    const card = await section();
    const gone = (await within(card).findByText("documentation/old-page.md")).closest(".refrow") as HTMLElement;
    await within(gone).findByText("Not found");
    expect(gone).toHaveClass("missing");
    const here = within(card).getByText("documentation/intro.md").closest(".refrow") as HTMLElement;
    expect(within(here).queryByText("Not found")).toBeNull();
  });

  it("marks a folder that is gone and checks a name by kind", async () => {
    openIssue(
      fakeReferences([
        reference({ id: "f", kind: "folder", repo: "hub-steward-swe", target: "loader" }),
        reference({ id: "g", kind: "folder", repo: "hub-steward-swe", target: "README.md" }),
      ]),
    );
    const card = await section();
    const wrongKind = (await within(card).findByText("README.md")).closest(".refrow") as HTMLElement;
    await within(wrongKind).findByText("Not found");
    const real = within(card).getByText("loader").closest(".refrow") as HTMLElement;
    expect(within(real).queryByText("Not found")).toBeNull();
  });

  it("marks nothing when the repo cannot be read", async () => {
    const client = fakeReferences([reference({ id: "x", repo: "elsewhere", target: "a/b.go" })]);
    const repos = fakeRepos();
    openIssue(client, repos);
    const card = await section();
    await within(card).findByText("a/b.go");
    await waitFor(() => expect(repos.entries).toHaveBeenCalled());
    expect(within(card).queryByText("Not found")).toBeNull();
  });

  it("opens a board row as that issue", async () => {
    const client = fakeReferences([reference({ id: "i", kind: "issue", repo: "", target: "HS-005" })], { findIssue: async () => "t5" });
    openIssue(client);
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: /HS-005/ }));
    await waitFor(() => expect(screen.getByTestId("here")).toHaveTextContent("/a/hub-1/backlogs/issue/t5"));
  });
});
