import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpError, callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { PublishView } from "./PublishView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const scenario = (id: string, name: string, result: string) => ({
  id,
  name,
  summary: "tries " + name,
  workflow_id: "w1",
  workflow: "Buy now",
  result,
  last_run_id: "",
  rules: [],
});

const approval = (id: string, kind: string, title: string, by: string, at: string) => ({
  id,
  kind,
  summary: "Add " + title,
  payload: JSON.stringify({ title }),
  decided_by: by,
  decided_at: at,
});

const approvals = {
  items: [
    approval("a1", "agency_create_objective", "Record each farmer's payment", "Group coordinator", "2026-10-30T09:40:00Z"),
    approval("a2", "agency_create_role", "Suppliers' agent", "Group coordinator", "2026-10-30T09:12:00Z"),
  ],
};

const blocked = {
  agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
  agency_list_approvals: approvals,
  agency_list_publications: { items: [] },
  agency_list_scenarios: {
    items: [scenario("s1", "Shop says yes", "passed"), scenario("s2", "Find it", "failed"), scenario("s3", "Farmer stays silent", "not_run")],
  },
};

const ready = {
  ...blocked,
  agency_list_scenarios: { items: [scenario("s1", "Shop says yes", "passed"), scenario("s2", "Find it", "passed")] },
};

const show = (replies: Parameters<typeof answering>[0]) => {
  answering(replies);
  return renderView("publish", PublishView);
};

const publishButton = () => screen.getByRole("button", { name: "Publish" });

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the Publish page while a scenario has not passed", () => {
  it("keeps Publish enabled, warns, and names each scenario that has not passed with its result", async () => {
    show(blocked);

    const section = (await screen.findByRole("heading", { name: "Scenarios that have not passed" })).closest("section") as HTMLElement;

    expect(publishButton()).toBeEnabled();
    expect(within(section).getByText("Publishing is still allowed. These scenarios have not passed on this draft.")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Find it" })).toHaveAttribute("href", "/h/h1/test?open=s2");
    expect(within(section).getByText("Failed")).toHaveClass("bad");
    expect(within(section).getByRole("link", { name: "Farmer stays silent" })).toBeInTheDocument();
    expect(within(section).getByText("Not run yet")).toHaveClass("mute");
    expect(within(section).queryByText("Shop says yes")).not.toBeInTheDocument();
  });

  it("offers Run for one with no run and Open run for one with a last run", async () => {
    show({
      ...blocked,
      agency_list_scenarios: {
        items: [{ ...scenario("s2", "Find it", "failed"), last_run_id: "r2" }, scenario("s3", "Farmer stays silent", "not_run")],
      },
    });

    const failed = (await screen.findByText("Find it")).closest("tr") as HTMLElement;
    const waiting = screen.getByText("Farmer stays silent").closest("tr") as HTMLElement;

    expect(within(failed).getByRole("link", { name: "Open run" })).toHaveAttribute("href", "/h/h1/test?run=r2");
    expect(within(waiting).getByRole("link", { name: "Run" })).toHaveAttribute("href", "/h/h1/test?open=s3");
  });

  it("lists what would be published with its kind, who approved it and where to open it", async () => {
    show(blocked);

    const row = (await screen.findByText("Record each farmer's payment")).closest("tr") as HTMLElement;

    expect(within(row).getByText("Objective")).toBeInTheDocument();
    expect(within(row).getByText("Group coordinator")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/goals");
    expect(screen.getByText("Suppliers' agent")).toBeInTheDocument();
  });

  it("does not say every scenario passed while some have not", async () => {
    show(blocked);
    await screen.findByText("Find it");

    expect(screen.queryByText("Every scenario has passed on this draft")).not.toBeInTheDocument();
  });

  it("counts a scenario that is still running or stopped as not passed", async () => {
    show({
      ...ready,
      agency_list_scenarios: { items: [scenario("s1", "Shop says yes", "running"), scenario("s2", "Find it", "stopped")] },
    });

    expect(await screen.findByText("Shop says yes")).toBeInTheDocument();
    expect(screen.getByText("Stopped")).toHaveClass("warn");
    expect(publishButton()).toBeEnabled();
  });

  it("publishes the open draft although a scenario has not passed", async () => {
    show({ ...blocked, agency_list_issues: { items: [] }, agency_publish_agency: { version: 5, tag: "v5", published_at: "2026-10-30T10:00:00Z" } });
    await screen.findByText("Find it");

    await userEvent.click(publishButton());

    expect(await screen.findByText("Published as version 5")).toBeInTheDocument();
    expect(callsTo("agency_publish_agency")).toEqual([{ draft_id: "d1", channel: "production" }]);
  });
});

describe("the Publish page when every scenario has passed", () => {
  it("enables Publish and says in one line that a publish reaches members within 30 seconds", async () => {
    show(ready);

    expect(await screen.findByText("Every scenario has passed on this draft")).toBeInTheDocument();
    expect(screen.getByText("A publish reaches members within 30 seconds.")).toBeInTheDocument();
    expect(publishButton()).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Scenarios that have not passed" })).not.toBeInTheDocument();
  });

  it("publishes the open draft after the check finds no problem and says which version it is", async () => {
    show({ ...ready, agency_list_issues: { items: [] }, agency_publish_agency: { version: 4, tag: "v4", published_at: "2026-10-30T10:00:00Z" } });
    await screen.findByText("Every scenario has passed on this draft");

    await userEvent.click(publishButton());

    expect(await screen.findByText("Published as version 4")).toBeInTheDocument();
    expect(callsTo("agency_publish_agency")).toEqual([{ draft_id: "d1", channel: "production" }]);
    expect(publishButton()).toBeDisabled();
  });

  it("lists a workflow with no objective as a problem that blocks the publish and opens that workflow", async () => {
    show({
      ...ready,
      agency_list_issues: {
        items: [{ severity: "error", message: 'Workflow W-1 "Group order" has no Objective', entity_type: "workflow", entity_id: "w1" }],
      },
    });
    await screen.findByText("Every scenario has passed on this draft");

    await userEvent.click(publishButton());

    const problem = (await screen.findByText('Workflow W-1 "Group order" has no Objective')).closest(".empty") as HTMLElement;
    expect(problem).toHaveClass("error");
    expect(within(problem).getByRole("link", { name: "Open the workflow" })).toHaveAttribute("href", "/h/h1/workflows?open=w1");
    expect(callsTo("agency_publish_agency")).toEqual([]);
  });

  it("says the agency could not be published when the agency refuses", async () => {
    show({ ...ready, agency_list_issues: { items: [] }, agency_publish_agency: new McpError("agency_publish_agency: down") });
    await screen.findByText("Every scenario has passed on this draft");

    await userEvent.click(publishButton());

    expect(await screen.findByText("The agency could not be published. Try again.")).toHaveClass("error");
    expect(publishButton()).toBeEnabled();
  });
});

describe("the Publish page with nothing to publish", () => {
  it("says nothing is waiting and keeps Publish disabled even when every scenario has passed", async () => {
    show({ ...ready, agency_list_approvals: { items: [] } });

    expect(await screen.findByText("Nothing is waiting to be published.")).toBeInTheDocument();
    expect(publishButton()).toBeDisabled();
  });

  it("reads the open draft, its approvals, the publications and the scenarios of the draft", async () => {
    show(ready);
    await screen.findByText("Every scenario has passed on this draft");

    expect(callsTo("agency_list_approvals")).toEqual([{ status: "approved" }]);
    expect(callsTo("agency_list_scenarios")).toEqual([{ draft_id: "d1" }]);
  });
});

describe("the Publish page lists the versions already published", () => {
  it("shows each version with its tag, its channel and when, the newest first", async () => {
    show({
      ...ready,
      agency_list_publications: {
        items: [
          { version: 1, tag: "v1", channel: "", published_at: "2026-11-01T10:00:00Z" },
          { version: 2, tag: "harvest", channel: "production", published_at: "2026-11-02T10:00:00Z" },
        ],
      },
    });

    expect(await screen.findByText("Published versions")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").filter((row) => /harvest|v1/.test(row.textContent ?? ""));
    expect(rows[0]).toHaveTextContent("harvest");
    expect(rows[0]).toHaveTextContent("production");
    expect(rows[1]).toHaveTextContent("v1");
    expect(rows[1]).toHaveTextContent("Archived");
  });

  it("puts an Open link on each version's row that opens its components", async () => {
    show({
      ...ready,
      agency_list_publications: {
        items: [
          { version: 1, tag: "v1", channel: "", published_at: "2026-11-01T10:00:00Z" },
          { version: 2, tag: "harvest", channel: "production", published_at: "2026-11-02T10:00:00Z" },
        ],
      },
    });

    await screen.findByText("Published versions");
    const row = screen.getAllByRole("row").find((candidate) => /harvest/.test(candidate.textContent ?? "")) as HTMLElement;
    expect(within(row).getByRole("link", { name: /Open/ })).toHaveAttribute("href", expect.stringContaining("publish?version=2"));
  });

  it("says nothing has been published yet when there is no version", async () => {
    show(ready);

    expect(await screen.findByText("Nothing has been published yet.")).toBeInTheDocument();
  });
});

const textOfBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

describe("the Publish page opened on one published version", () => {
  const publication = {
    version: 1,
    tag: "v1",
    channel: "production",
    published_at: "2026-11-01T10:00:00Z",
    document: {
      agency: { name: "Siaya Farmers' Group" },
      roles: [
        { id: "r1", code: "R-1", name: "Farmer", description: "Grows produce." },
        { id: "r2", code: "R-2", name: "Buyer" },
      ],
      goals: [{ id: "g1", code: "G-1", title: "Sell the harvest" }],
      workflows: [{ id: "w1", code: "W-14", name: "Sell harvest" }],
      objectives: [{ id: "o1", code: "O-1", title: "Sell every bag" }],
      workflow_objectives: [{ id: "x1", workflow_id: "w1", objective_id: "o1" }],
      work_items: [
        { id: "i2", code: "WI-2", workflow_id: "w1", title: "Accept the offer", kind: "yes_no", ordinality: 2, role_id: "r2" },
        { id: "i1", code: "WI-1", workflow_id: "w1", title: "Offer the harvest", kind: "fill_form", ordinality: 1, role_id: "r1" },
      ],
      rules: [{ id: "u1", code: "RU-1", text: "No timers" }],
      rule_attachments: [{ rule_code: "RU-1", target_type: "objective", target_code: "O-1" }],
      hazards: [],
    },
  };
  const open = () => {
    answering({ ...ready, agency_get_publication: publication });
    return renderView("publish", PublishView, "?version=1");
  };

  it("browses the components of the version, each with its count and what is in it", async () => {
    open();

    expect(await screen.findByText("Roles (2)")).toBeInTheDocument();
    expect(screen.getByText("Farmer")).toBeInTheDocument();
    expect(screen.getByText("R-1 · Grows produce.")).toBeInTheDocument();
    expect(screen.getByText("Goals (1)")).toBeInTheDocument();
    expect(screen.getByText("Sell the harvest")).toBeInTheDocument();
    expect(screen.queryByText(/Hazards/)).not.toBeInTheDocument();
    expect(callsTo("agency_get_publication")).toEqual([{ version: 1 }]);
  });

  it("nests each workflow's steps and the objectives it serves inside the workflow, in order", async () => {
    open();

    const workflow = (await screen.findByText("W-14 Sell harvest")).closest("section") as HTMLElement;
    expect(within(workflow).getByText("Serves: O-1 Sell every bag")).toBeInTheDocument();
    const steps = within(workflow).getAllByRole("row").slice(1);
    expect(steps[0]).toHaveTextContent("Offer the harvest");
    expect(steps[0]).toHaveTextContent("R-1 Farmer");
    expect(steps[0]).toHaveTextContent("market.ask");
    expect(steps[1]).toHaveTextContent("Accept the offer");
    expect(steps[1]).toHaveTextContent("market.ask_answer");
    expect(screen.queryByText(/^Work items/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Workflow objectives/)).not.toBeInTheDocument();
  });

  it("names a link between two things by what it joins and never by its id", async () => {
    open();

    expect(await screen.findByText("RU-1 No timers → O-1 Sell every bag")).toBeInTheDocument();
  });

  it("downloads the version's document as a json file named for the agency and the tag", async () => {
    const urls = { createObjectURL: vi.fn((_blob: Blob) => "blob:test"), revokeObjectURL: vi.fn() };
    Object.assign(URL, urls);
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("button", { name: "Download JSON" }));

    expect(clicked).toEqual(["siaya-farmers-group-v1.json"]);
    const blob = urls.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await textOfBlob(blob))).toEqual(publication.document);
  });
});

describe("the Publish page when it cannot load", () => {
  it("says the page could not be loaded", async () => {
    show({ ...blocked, agency_list_scenarios: new McpError("agency_list_scenarios: down") });

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
  });
});
