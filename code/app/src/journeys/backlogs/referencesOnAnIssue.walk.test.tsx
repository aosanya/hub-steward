import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { backlogTools } from "../../backlogManage/api";
import { taskTools } from "../../backlogs/api";
import { referenceTools } from "../../backlogs/references/api";
import { beforeEachJourney, endInAgencies, inFarmers, issues, where } from "./backlogs.test-support";
import { farmers } from "../inAgency.test-support";

beforeEach(beforeEachJourney);

afterEach(endInAgencies);

type Held = { id: string; task_id: string; kind: string; repo?: string; target: string; source: string; confirmed: boolean };

const held = (over: Partial<Held>): Held => ({ id: "r0", task_id: "t1", kind: "file", target: "x", source: "person", confirmed: true, ...over });

const tree: Record<string, { name: string; path: string; is_dir: boolean }[]> = {
  "": [
    { name: "loader", path: "loader", is_dir: true },
    { name: "README.md", path: "README.md", is_dir: false },
  ],
  loader: [
    { name: "importer.go", path: "loader/importer.go", is_dir: false },
    { name: "report.go", path: "loader/report.go", is_dir: false },
  ],
};

const worldWith = (rows: Held[]) => ({
  [referenceTools.list]: () => ({ items: rows }),
  [referenceTools.add]: (args: Record<string, unknown>) => {
    const added = held({ id: `n${rows.length + 1}`, kind: String(args.kind), repo: args.repo as string | undefined, target: String(args.target) });
    rows.push(added);
    return added;
  },
  [referenceTools.confirm]: (args: Record<string, unknown>) => {
    rows.forEach((one) => one.id === args.referenceID && (one.confirmed = true));
    return rows.find((one) => one.id === args.referenceID);
  },
  [referenceTools.remove]: (args: Record<string, unknown>) => {
    rows.splice(0, rows.length, ...rows.filter((one) => one.id !== args.referenceID));
    return {};
  },
  [referenceTools.repos]: () => ({ items: [{ id: "g1", name: "hub-steward-swe", default_branch: "main", default_branch_id: "b1" }] }),
  [referenceTools.directory]: (args: Record<string, unknown>) => ({ items: args.branchID === "b1" ? tree[String(args.path ?? "")] ?? [] : [] }),
  [taskTools.pending]: (args: Record<string, unknown>) => ({ items: args.q === "HS-005" ? [{ id: "t2", code: "HS-005", title: "Write the manual" }] : [] }),
});

const section = async () => {
  const card = (await screen.findByText("References")).closest("section") as HTMLElement;
  const head = within(card).getByRole("button", { name: "References" });
  if (head.getAttribute("aria-expanded") === "false") await userEvent.click(head);
  return card;
};

describe("journey 03, step 9, names what an issue is about", () => {
  it("an issue with no entries says Nothing referenced yet. above Add a reference, under the description and above the Log", async () => {
    inFarmers("/backlogs/issue/t1", worldWith([]));
    const card = await section();
    expect(await within(card).findByText("Nothing referenced yet.")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Add a reference" })).toBeInTheDocument();
    const titles = Array.from(document.querySelectorAll(".issue-side .card-title")).map((one) => one.textContent);
    expect(titles.indexOf("References")).toBeLessThan(titles.indexOf("Log"));
  });

  it("adds a file by repo, folder and tap, then a board row and a website link by one typed line", async () => {
    const rows: Held[] = [];
    const world = inFarmers("/backlogs/issue/t1", worldWith(rows));
    await userEvent.click(within(await section()).getByRole("link", { name: "Add a reference" }));
    expect(where()).toBe(`/a/${farmers.id}/backlogs/issue/t1/references/add`);
    await userEvent.click(await screen.findByRole("button", { name: /^File/ }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Find a repo" }), "hub-steward-swe");
    await userEvent.click(await screen.findByRole("button", { name: "hub-steward-swe" }));
    await userEvent.click(await screen.findByRole("button", { name: /loader/ }));
    await userEvent.click(await screen.findByRole("button", { name: /importer.go/ }));
    await waitFor(() => expect(where()).toBe(`/a/${farmers.id}/backlogs/issue/t1`));
    expect(world.named(referenceTools.add)[0]?.args).toMatchObject({ taskID: "t1", kind: "file", repo: "hub-steward-swe", target: "loader/importer.go" });
    expect(world.named(referenceTools.directory).map((call) => [call.args.branchID, call.args.path])).toContainEqual(["b1", "loader"]);
    const card = await section();
    const entry = (await within(card).findByText("loader/importer.go")).closest(".refrow") as HTMLElement;
    expect(within(entry).getByText("hub-steward-swe · File")).toBeInTheDocument();
    expect(within(entry).getByText("Person")).toBeInTheDocument();

    await userEvent.click(within(card).getByRole("link", { name: "Add a reference" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Board row/ }));
    await userEvent.type(screen.getByLabelText("Issue number"), "HS-005");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await within(await section()).findByText("HS-005");

    await userEvent.click(within(await section()).getByRole("link", { name: "Add a reference" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Website link/ }));
    await userEvent.type(screen.getByLabelText("Website link"), "https://example.test/spec");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await within(await section()).findByRole("link", { name: /https:\/\/example.test\/spec/ })).toHaveAttribute("href", "https://example.test/spec");
    expect(world.named(referenceTools.add).map((call) => call.args.kind)).toEqual(["file", "issue", "link"]);
  });

  it("a board row entry opens that issue", async () => {
    inFarmers("/backlogs/issue/t1", worldWith([held({ id: "i", kind: "issue", target: "HS-005" })]));
    await section();
    await userEvent.click(await screen.findByRole("button", { name: /HS-005/ }));
    await waitFor(() => expect(where()).toBe(`/a/${farmers.id}/backlogs/issue/t2`));
  });

  it("an assistant entry nobody confirmed has Confirm, which becomes Confirmed and keeps Assistant proposed", async () => {
    const world = inFarmers("/backlogs/issue/t1", worldWith([held({ id: "p1", repo: "hub-steward-swe", target: "loader/report.go", source: "assistant", confirmed: false })]));
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Confirm" }));
    expect(world.named(referenceTools.confirm)[0]?.args).toMatchObject({ taskID: "t1", referenceID: "p1" });
    const entry = (await within(card).findByText("Confirmed")).closest(".refrow") as HTMLElement;
    expect(within(entry).getByText("Assistant proposed")).toBeInTheDocument();
    expect(within(entry).queryByRole("button", { name: "Confirm" })).toBeNull();
  });

  it("a file that is no longer on the repo is struck through and marked Not found, and its cross removes it", async () => {
    const world = inFarmers("/backlogs/issue/t1", worldWith([held({ id: "old", repo: "hub-steward-swe", target: "loader/old-importer.go" }), held({ id: "ok", repo: "hub-steward-swe", target: "loader/importer.go" })]));
    const card = await section();
    const gone = (await within(card).findByText("loader/old-importer.go")).closest(".refrow") as HTMLElement;
    await within(gone).findByText("Not found");
    expect(gone).toHaveClass("missing");
    expect(within((within(card).getByText("loader/importer.go")).closest(".refrow") as HTMLElement).queryByText("Not found")).toBeNull();
    await userEvent.click(within(gone).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(within(card).queryByText("loader/old-importer.go")).toBeNull());
    expect(world.named(referenceTools.remove)[0]?.args).toMatchObject({ taskID: "t1", referenceID: "old" });
  });

  it("a reader who cannot move the issue still gets Add a reference", async () => {
    inFarmers("/backlogs/issue/t1", { ...worldWith([]), [backlogTools.myRoles]: () => ({ permissions: ["task.read"] }) });
    expect(within(await section()).getByRole("link", { name: "Add a reference" })).toBeInTheDocument();
  });

  it("the issue's row on the list shows nothing of its references", async () => {
    inFarmers("/backlogs/issues", { ...worldWith([held({ target: "loader/importer.go" })]), [taskTools.list]: () => ({ items: issues }) });
    await screen.findByText("Import the boards");
    expect(screen.queryByText("References")).toBeNull();
    expect(screen.queryByText("loader/importer.go")).toBeNull();
  });
});
