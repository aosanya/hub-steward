import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeReferences, fakeRepos, openIssue, reference } from "./referenceFixtures";

const add = "/a/hub-1/backlogs/issue/1/references/add";

const toRepoTree = async (kind: string) => {
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${kind}`) }));
  await userEvent.type(await screen.findByRole("searchbox", { name: "Find a repo" }), "hub-steward-swe");
  await userEvent.click(screen.getByRole("button", { name: "hub-steward-swe" }));
};

describe("adding a reference", () => {
  it("asks what is being referenced, a file first", async () => {
    openIssue(fakeReferences(), fakeRepos(), add);
    const names = (await screen.findAllByRole("button", { name: /^(File|Folder|Board row|Screen or tool|Website link)/ })).map((one) => one.querySelector(".ttl")?.textContent);
    expect(names).toEqual(["File", "Folder", "Board row", "Screen or tool", "Website link"]);
  });

  it("Cancel returns to the issue", async () => {
    openIssue(fakeReferences(), fakeRepos(), add);
    await userEvent.click(await screen.findByRole("button", { name: /Cancel/ }));
    expect(screen.getByTestId("here")).toHaveTextContent("/a/hub-1/backlogs/issue/1");
    expect(screen.getByTestId("here")).not.toHaveTextContent("references/add");
  });

  it("picks a file: the repo, then the tree one folder at a time, and a tap on the file adds it", async () => {
    const client = fakeReferences();
    openIssue(client, fakeRepos(), add);
    await toRepoTree("File");
    expect(await screen.findByText("hub-steward-swe", { selector: ".crumb" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /loader/ }));
    expect(await screen.findByRole("button", { name: /importer.go/ })).toBeInTheDocument();
    expect(screen.getByText("hub-steward-swe/loader", { selector: ".crumb" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /importer.go/ }));
    expect(client.add).toHaveBeenCalledWith("1", "file", "hub-steward-swe", "loader/importer.go");
    await waitFor(() => expect(screen.getByTestId("here")).toHaveTextContent(/backlogs\/issue\/1$/));
  });

  it("goes up one folder", async () => {
    openIssue(fakeReferences(), fakeRepos(), add);
    await toRepoTree("File");
    await userEvent.click(await screen.findByRole("button", { name: /loader/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Up one folder/ }));
    expect(await screen.findByRole("button", { name: /README.md/ })).toBeInTheDocument();
  });

  it("picks a folder with Use this folder, which is not offered at the root", async () => {
    const client = fakeReferences();
    openIssue(client, fakeRepos(), add);
    await toRepoTree("Folder");
    await screen.findByRole("button", { name: /loader/ });
    expect(screen.queryByRole("button", { name: "Use this folder" })).toBeNull();
    expect(screen.queryByRole("button", { name: /README.md/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /loader/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Use this folder" }));
    expect(client.add).toHaveBeenCalledWith("1", "folder", "hub-steward-swe", "loader");
  });

  it("offers the repos the catalog lists, filtered by the find box", async () => {
    openIssue(fakeReferences(), fakeRepos({ repos: async () => ["hub-steward", "hub-steward-swe", "mwanachama-backend-catalog"] }), add);
    await userEvent.click(await screen.findByRole("button", { name: /^File/ }));
    expect(await screen.findByRole("button", { name: "mwanachama-backend-catalog" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox", { name: "Find a repo" }), "catalog");
    expect(screen.queryByRole("button", { name: "hub-steward" })).toBeNull();
    expect(screen.getByRole("button", { name: "mwanachama-backend-catalog" })).toBeInTheDocument();
  });

  it("when the tree cannot be read, asks for the path typed", async () => {
    const client = fakeReferences();
    openIssue(client, fakeRepos(), add);
    await userEvent.click(await screen.findByRole("button", { name: /^File/ }));
    await userEvent.type(await screen.findByRole("searchbox", { name: "Find a repo" }), "elsewhere");
    await userEvent.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(await screen.findByText("The tree of elsewhere could not be read.")).toBeInTheDocument();
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Path in elsewhere"), "/docs/a.md");
    await userEvent.click(addButton);
    expect(client.add).toHaveBeenCalledWith("1", "file", "elsewhere", "/docs/a.md");
  });

  it.each([
    ["Board row", "Issue number", "HS-005", "issue"],
    ["Screen or tool", "Screen or tool name", "agency_list_mounts", "screen"],
    ["Website link", "Website link", "https://example.test/spec", "link"],
  ])("%s takes one typed line, and Add is off until something is typed", async (button, label, typed, kind) => {
    const client = fakeReferences();
    openIssue(client, fakeRepos(), add);
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${button}`) }));
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
    await userEvent.type(screen.getByLabelText(label), typed);
    await userEvent.click(addButton);
    expect(client.add).toHaveBeenCalledWith("1", kind, "", typed);
    await waitFor(() => expect(screen.getByTestId("here")).toHaveTextContent(/backlogs\/issue\/1$/));
  });

  it("says so when the issue already has that and stays on the page", async () => {
    const client = fakeReferences([reference({ kind: "link", repo: "", target: "https://example.test/a" })], { add: async () => Promise.reject(new Error("409 the issue already refers to that")) });
    openIssue(client, fakeRepos(), add);
    await userEvent.click(await screen.findByRole("button", { name: /^Website link/ }));
    await userEvent.type(screen.getByLabelText("Website link"), "https://example.test/a");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That could not be added.");
    expect(screen.getByTestId("here")).toHaveTextContent("references/add");
  });
});
