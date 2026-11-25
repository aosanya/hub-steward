import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency } from "../../../shared/wakala/openAgency";
import type { FilesClient } from "../../files";
import { RecordPage } from "./RecordPage";
import { arrive, at, clientOf, file, issue, opened, ready, rule } from "./rulebookFixture";
import type { OpenedRule, RulebookClient } from "./types";

vi.mock("../../../shared/wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/wakala/mcp")>("../../../shared/wakala/mcp");
  return { ...actual, callTool: async () => ({ items: [] }) };
});

beforeEach(arrive);

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const route = "/a/:agencyId/backlogs/rule/:ruleCode";

const folders = async () => [{ id: "folder-1", name: "hub-steward", branchId: "main", changedAt: "" }];

const filesClient = (over: Partial<FilesClient> = {}) => ({ folders, ...over }) as FilesClient;

const open = (record: OpenedRule, files = filesClient(), client: RulebookClient = clientOf({ open: async () => ready(record) })) => {
  const path = `/a/hub-1/backlogs/rule/${record.rule.code}`;
  return at(path, route, <RecordPage client={client} files={files} />);
};

const card = (name: string) => screen.getByRole("button", { name: new RegExp(name) }).closest("section") as HTMLElement;

const ruleRecord = () =>
  opened(rule({ code: "R-2", title: "Font sizes are in rem", tags: ["css", "app"], body: "One root value makes **text size** a one-number change." }), {
    why: rule({ kind: "decision", code: "D-3", title: "One root value", status: "decided" }),
    files: [file(), file({ id: "f2", path: "gone.css", missing: true })],
    issues: [issue("ISS-169", "Hub: the demo screens"), issue("ISS-218", "Hub: move to sibling v0.4.0")],
  });

describe("a rule on a phone", () => {
  it("shows its title, code and kind, status, tags and body", async () => {
    open(ruleRecord());
    expect(await screen.findByRole("heading", { name: "Font sizes are in rem" })).toBeInTheDocument();
    expect(screen.getByText("R-2 · Rule")).toBeInTheDocument();
    const details = screen.getByRole("region", { name: "Details" });
    expect(within(details).getByText("In force")).toBeInTheDocument();
    expect(within(details).getByText("css")).toBeInTheDocument();
    expect(within(details).getByText("app")).toBeInTheDocument();
    expect(screen.getByText("text size", { selector: "strong" })).toBeInTheDocument();
  });

  it("shows the decision it comes from as a Why row that opens that decision", async () => {
    open(ruleRecord());
    const why = await screen.findByRole("button", { name: /D-3/ });
    expect(why.textContent).toContain("One root value");
    expect(why.textContent).toContain("›");
    await userEvent.click(why);
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/rule/D-3");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "")).toMatchObject({ backTo: "/a/hub-1/backlogs/rule/R-2", backLabel: "R-2" });
  });

  it("shows no Why row when no decision was found", async () => {
    open(opened(rule({ code: "R-2", body: "A reason." })));
    await screen.findByText("A reason.");
    expect(screen.queryByRole("button", { name: /D-3/ })).toBeNull();
  });

  it("keeps the references in one closed single-line card that opens on a tap", async () => {
    open(ruleRecord());
    await screen.findByRole("heading", { name: "Font sizes are in rem" });
    const toggle = screen.getByRole("button", { name: "References" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("code/app/src/tokens.css")).toBeNull();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("code/app/src/tokens.css")).toBeInTheDocument();
  });

  it("lists a file with its repo and main, and a missing one with Not found on main and no chevron", async () => {
    open(ruleRecord());
    await userEvent.click(await screen.findByRole("button", { name: "References" }));
    const found = (await screen.findByRole("button", { name: /tokens\.css/ })) as HTMLElement;
    expect(found.textContent).toContain("hub-steward · main");
    expect(found.textContent).toContain("›");
    const gone = screen.getByText("gone.css").closest(".row") as HTMLElement;
    expect(within(gone).getByText("Not found on main")).toBeInTheDocument();
    expect(gone.textContent).not.toContain("›");
    expect(gone.tagName).not.toBe("BUTTON");
  });

  it("opens a file in the Files screen of the folder named like its repo", async () => {
    open(ruleRecord());
    await userEvent.click(await screen.findByRole("button", { name: "References" }));
    await userEvent.click(await screen.findByRole("button", { name: /tokens\.css/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/files/folder-1/file?path=code%2Fapp%2Fsrc%2Ftokens.css");
  });

  it("shows a file with no chevron and no link when no folder carries its repo name", async () => {
    open(ruleRecord(), filesClient({ folders: async () => [] }));
    await userEvent.click(await screen.findByRole("button", { name: "References" }));
    const row = (await screen.findByText("code/app/src/tokens.css")).closest(".row") as HTMLElement;
    expect(row.tagName).not.toBe("BUTTON");
    expect(row.textContent).not.toContain("›");
  });

  it("picks the folder named like the repo among several", async () => {
    const two = filesClient({
      folders: async () => [
        { id: "folder-a", name: "other-repo", branchId: "main", changedAt: "" },
        { id: "folder-b", name: "hub-steward", branchId: "main", changedAt: "" },
      ],
    });
    open(ruleRecord(), two);
    await userEvent.click(await screen.findByRole("button", { name: "References" }));
    await userEvent.click(await screen.findByRole("button", { name: /tokens\.css/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/files/folder-b/file?");
  });

  it("asks the Files screen for folders only when the rule has files", async () => {
    const folders = vi.fn(async () => []);
    open(opened(rule({ code: "R-2", body: "Because." }), { issues: [issue("ISS-1", "One")] }), filesClient({ folders }));
    await screen.findByText("Because.");
    expect(folders).not.toHaveBeenCalled();
  });

  it("shows no References card when the record has no files and no issues", async () => {
    open(opened(rule({ code: "R-2", body: "Because." })));
    await screen.findByText("Because.");
    expect(screen.queryByRole("button", { name: "References" })).toBeNull();
  });

  it("lists the issues that follow it and opens one with a way back", async () => {
    open(ruleRecord());
    await userEvent.click(await screen.findByRole("button", { name: "References" }));
    await userEvent.click(await screen.findByRole("button", { name: /ISS-218/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/issue/id-ISS-218");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "")).toMatchObject({ backTo: "/a/hub-1/backlogs/rule/R-2" });
  });

  it("says what it replaces and what replaced it", async () => {
    open(opened(rule({ code: "R-2", supersedes: "R-6" })));
    expect(await screen.findByText("Replaces R-6. Replaced by nothing.")).toBeInTheDocument();
  });

  it("goes back to the list it came from, named for its kind", async () => {
    open(ruleRecord());
    await screen.findByRole("heading", { name: "Font sizes are in rem" });
    await userEvent.click(screen.getByRole("button", { name: /‹ Rules/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/all/rulebook?kind=rule");
  });
});

describe("a decision on a phone", () => {
  const decision = () =>
    opened(rule({ kind: "decision", code: "D-3", title: "A good example is a link", status: "decided", tags: ["rules"], decidedBy: "Owner", decidedAt: "2026-11-25", body: "The rule holds no copy." }), {
      produced: [rule({ code: "R-2", title: "Font sizes are in rem" })],
      settledIn: [issue("ISS-246", "A Rules view", "decided_in")],
      issues: [issue("ISS-246", "A Rules view", "decided_in"), issue("ISS-300", "Another issue")],
    });

  it("shows who decided and when, the reason, and the rules it produced", async () => {
    open(decision());
    expect(await screen.findByText("D-3 · Decision")).toBeInTheDocument();
    expect(screen.getByText(/Decided by Owner, .*25 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why" })).toBeInTheDocument();
    expect(screen.getByText("The rule holds no copy.")).toBeInTheDocument();
    expect(within(card("Rules it produced")).getByText("Font sizes are in rem")).toBeInTheDocument();
  });

  it("says only who decided when the hub gives no date and no creation time, as the live data does", async () => {
    open(opened(rule({ kind: "decision", code: "D-3", title: "Live decision", status: "decided", decidedBy: "owner", decidedAt: "", createdAt: "" })));
    expect(await screen.findByText("Decided by owner")).toBeInTheDocument();
    expect(screen.queryByText(/Decided by owner,/)).toBeNull();
  });

  it("falls back to the time it was created when it has no decided date", async () => {
    open(opened(rule({ kind: "decision", code: "D-3", title: "Live decision", status: "decided", decidedBy: "owner", decidedAt: "", createdAt: "2026-11-20T10:00:00Z" })));
    expect(await screen.findByText(/Decided by owner, .*20 Nov 2026/)).toBeInTheDocument();
  });

  it("prefers the decided date to the created time", async () => {
    open(opened(rule({ kind: "decision", code: "D-3", title: "Live decision", status: "decided", decidedBy: "owner", decidedAt: "2026-11-25", createdAt: "2026-11-20T10:00:00Z" })));
    expect(await screen.findByText(/Decided by owner, .*25 Nov 2026/)).toBeInTheDocument();
  });

  it("opens a rule it produced", async () => {
    open(decision());
    await userEvent.click(await screen.findByRole("button", { name: /R-2/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/rule/R-2");
  });

  it("shows where it was settled apart from the other issues", async () => {
    open(decision());
    await screen.findByText("D-3 · Decision");
    expect(within(card("Settled in")).getByText("A Rules view")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "References" }));
    expect(within(card("References")).queryByText("A Rules view")).toBeNull();
    expect(within(card("References")).getByText("Another issue")).toBeInTheDocument();
  });

  it("goes back to the Decisions it came from", async () => {
    open(decision());
    await screen.findByText("D-3 · Decision");
    await userEvent.click(screen.getByRole("button", { name: /‹ Decisions/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/all/rulebook?kind=decision");
  });
});

describe("a question on a phone", () => {
  const question = (over = {}) => opened(rule({ kind: "question", code: "Q-1", title: "A bad example beside it?", status: "open", priority: "P1", tags: ["rules"], body: "It may teach faster.", ...over }));

  it("shows the priority and why it is asked", async () => {
    open(question());
    expect(await screen.findByText("Q-1 · Question")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Details" })).getByText("P1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why it is asked" })).toBeInTheDocument();
    expect(screen.getByText("It may teach faster.")).toBeInTheDocument();
  });

  it("says Not answered yet while no decision answered it", async () => {
    open(question());
    await screen.findByText("Q-1 · Question");
    expect(within(card("Answered by")).getByText("Not answered yet")).toBeInTheDocument();
  });

  it("shows the decision that answered it and opens it", async () => {
    open(opened(rule({ kind: "question", code: "Q-1", title: "A bad example?", status: "answered", answeredBy: "D-3" }), { answer: rule({ kind: "decision", code: "D-3", title: "A good example is a link", status: "decided" }) }));
    await userEvent.click(await screen.findByRole("button", { name: /D-3/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/rule/D-3");
  });

  it("names the answering code even when the decision could not be read", async () => {
    open(question({ status: "answered", answeredBy: "D-9" }));
    expect(await screen.findByText("D-9")).toBeInTheDocument();
  });

  it("goes back to the Questions it came from", async () => {
    open(question());
    await screen.findByText("Q-1 · Question");
    expect(screen.getByRole("button", { name: /‹ Questions/ })).toBeInTheDocument();
  });

  it("does not offer Replaces for a question", async () => {
    open(question());
    await screen.findByText("Q-1 · Question");
    expect(screen.queryByText(/Replaces/)).toBeNull();
  });
});

describe("a record that cannot be shown", () => {
  const failing = (answer: unknown) => at("/a/hub-1/backlogs/rule/R-9", route, <RecordPage client={clientOf({ open: async () => answer as never })} files={filesClient()} />);

  it("says Loading while it waits", () => {
    at("/a/hub-1/backlogs/rule/R-9", route, <RecordPage client={clientOf({ open: () => new Promise(() => undefined) })} files={filesClient()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("says nothing has the code for an unknown code", async () => {
    failing({ state: "missing" });
    expect(await screen.findByText("Nothing has this code.")).toBeInTheDocument();
  });

  it("says it could not be opened, and tries again", async () => {
    const open = vi.fn().mockResolvedValueOnce({ state: "failed" }).mockResolvedValue(ready(opened(rule({ code: "R-9", title: "Back again" }))));
    at("/a/hub-1/backlogs/rule/R-9", route, <RecordPage client={clientOf({ open })} files={filesClient()} />);
    expect(await screen.findByText("This could not be opened.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Back again" })).toBeInTheDocument();
  });

  it("shows the no-access card for a viewer without rule.read", async () => {
    failing({ state: "no_access" });
    expect(await screen.findByText("You do not have access to the rules yet. Ask the Product owner.")).toBeInTheDocument();
  });

  it("shows the could-not-open line for a refusal", async () => {
    failing({ state: "forbidden" });
    await waitFor(() => expect(screen.getByText("This could not be opened.")).toBeInTheDocument());
  });
});
