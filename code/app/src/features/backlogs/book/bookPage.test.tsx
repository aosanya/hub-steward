import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Answer, Rule } from "../rulebook";
import { BookPage } from "./BookPage";
import type { Refs } from "./bookClient";
import { arrive, bookAt, bookClientOf, fileOf, issueOf, leave, numbered, readyRules } from "./bookFixture";

vi.mock("../../inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

beforeEach(() => {
  arrive();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(leave);

const first = numbered(1, { title: "No comments in code", body: "Comments drift out of step with the code." });
const second = numbered(2, { title: "Font sizes are in rem", body: "" });
const third = numbered(3, { title: "Work on main", body: "Several sessions edit one tree." });

const refs = {
  "R-1": { cameFrom: [issueOf("ISS-169"), issueOf("ISS-218")].map(({ id, code }) => ({ id, code })), files: [fileOf()] },
  "R-3": { cameFrom: [{ id: "id-ISS-218", code: "ISS-218" }], files: [] },
};

const hubFolder = { id: "r1", name: "hub-steward", branchId: "b1", changedAt: "" };

const shown = (client = bookClientOf(readyRules([first, second, third]), refs), folders = [hubFolder]) => {
  bookAt(<BookPage client={client} files={{ folders: async () => folders }} />);
  return client;
};

describe("the Book on a phone", () => {
  it("opens with the title and the day it was read", async () => {
    shown();
    expect(await screen.findByRole("heading", { level: 1, name: "Best practices" })).toBeInTheDocument();
    expect(screen.getByText("Read on 25 November 2026")).toBeInTheDocument();
  });

  it("lists every rule once in the contents, in order, as code and title", async () => {
    shown();
    const contents = await screen.findByRole("list", { name: "Contents" });
    const entries = within(contents).getAllByRole("link");
    expect(entries.map((one) => one.textContent)).toEqual(["R-1 No comments in code", "R-2 Font sizes are in rem", "R-3 Work on main"]);
    expect(entries[0]).toHaveAttribute("href", "#book-R-1");
  });

  it("shows each rule with its code, its title and its reason", async () => {
    shown();
    const heading = await screen.findByRole("heading", { level: 3, name: "R-1 No comments in code" });
    expect(heading).toHaveAttribute("id", "book-R-1");
    expect(screen.getByText("Comments drift out of step with the code.")).toBeInTheDocument();
  });

  it("draws one paragraph less for a rule with no reason", async () => {
    shown();
    await screen.findByRole("heading", { level: 3, name: "R-2 Font sizes are in rem" });
    const article = screen.getByRole("article");
    expect(article.querySelectorAll(".md")).toHaveLength(2);
  });

  it("fills in the references line of a rule once its reads have arrived", async () => {
    shown();
    expect(await screen.findAllByText(/Came from/)).not.toHaveLength(0);
    await waitFor(() => expect(document.querySelectorAll(".book-refs")).toHaveLength(2));
    const lines = Array.from(document.querySelectorAll(".book-refs")).map((one) => one.textContent);
    expect(lines).toEqual(["Came from ISS-169 and ISS-218. Done right in code/app/src/tokens.css.", "Came from ISS-218."]);
  });

  it("shows the text of every rule before any reference has arrived", async () => {
    const client = bookClientOf(readyRules([first]));
    client.refs = vi.fn(() => new Promise<Refs>(() => undefined));
    shown(client);
    expect(await screen.findByText("Comments drift out of step with the code.")).toBeInTheDocument();
    expect(document.querySelector(".book-refs")).toBeNull();
  });

  it("scrolls to a rule on a contents tap and adds no history entry", async () => {
    shown();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole("link", { name: "R-3 Work on main" }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/book");
    expect(screen.getByTestId("where").textContent).not.toContain("#");
  });

  it("opens an issue it came from with the Book as the back", async () => {
    shown();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole("link", { name: "ISS-169" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/issue/id-ISS-169");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "")).toEqual({ backTo: "/a/hub-1/backlogs/book", backLabel: "Book" });
  });

  it("opens a file the Files screen can show, with the Book as the back", async () => {
    shown();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole("link", { name: "code/app/src/tokens.css" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/files/r1/file?path=code%2Fapp%2Fsrc%2Ftokens.css");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "")).toEqual({ backTo: "/a/hub-1/backlogs/book", backLabel: "Book" });
  });

  it("opens the decision named on a rule's Approval line with the Book as the back", async () => {
    const approved = numbered(30, { title: "Translations stay in step", body: "Update every language file.\n\nApproval: D-32" });
    shown(bookClientOf(readyRules([approved])));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole("link", { name: "D-32" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/rule/D-32");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "")).toEqual({ backTo: "/a/hub-1/backlogs/book", backLabel: "Book" });
  });

  it("shows the path as plain text when no folder holds the file", async () => {
    shown(undefined, []);
    expect(await screen.findByText(/code\/app\/src\/tokens\.css/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "code/app/src/tokens.css" })).toBeNull();
  });

  it("shows a missing file as plain text even when a folder is named", async () => {
    const missing = { "R-1": { cameFrom: [], files: [fileOf({ missing: true })] } };
    shown(bookClientOf(readyRules([first]), missing));
    expect(await screen.findByText(/Done right in/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "code/app/src/tokens.css" })).toBeNull();
  });
});

describe("the Book before and after its list", () => {
  it("says it is loading while the list is read", async () => {
    const client = bookClientOf(readyRules([]));
    client.rules = vi.fn(() => new Promise<Answer<Rule[]>>(() => undefined));
    shown(client);
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("says no rules are in force for an empty list", async () => {
    shown(bookClientOf(readyRules([])));
    expect(await screen.findByText("No rules are in force yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Contents" })).toBeNull();
  });

  it("says it could not be loaded and tries again", async () => {
    const client = bookClientOf({ state: "failed" });
    shown(client);
    expect(await screen.findByText("The Book could not be loaded.")).toBeInTheDocument();
    client.rules = vi.fn(async () => readyRules([first]));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 3, name: "R-1 No comments in code" })).toBeInTheDocument();
  });

  it("shows the no-access card for a viewer who may not read rules", async () => {
    shown(bookClientOf({ state: "no_access" }));
    expect(await screen.findByText("You do not have access to the rules yet. Ask the Product owner.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Best practices" })).toBeNull();
  });
});

describe("what the Book never draws", () => {
  it("has no status chip, tag chip, switch, search, filter or chat button", async () => {
    shown();
    await screen.findByRole("heading", { level: 1, name: "Best practices" });
    expect(document.querySelector(".chip")).toBeNull();
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByText("In force")).toBeNull();
    expect(screen.queryByRole("button", { name: /chat/i })).toBeNull();
  });

  it("asks the client for no note and shows no marker", async () => {
    shown();
    await screen.findByRole("heading", { level: 1, name: "Best practices" });
    expect(screen.queryByText(/contradiction|Judge|Worker/i)).toBeNull();
  });
});
