import { callTool } from "../wakala/mcp";
import {
  changePageOf,
  changesPath,
  draftScope,
  isUnpublished,
  lastPublished,
  loadDraft,
  problemLink,
  publishDraft,
  scanDraft,
  showsDraftBar,
  workingDraftId,
} from "./draft";

vi.mock("../wakala/mcp");

type Args = Record<string, unknown>;
type Reply = unknown | ((args: Args) => unknown);

let calls: { hubId: string; tool: string; args: Args }[] = [];

const answerWith = (replies: Record<string, Reply>) => {
  calls = [];
  vi.mocked(callTool).mockImplementation(async (hubId, tool, args = {}) => {
    calls.push({ hubId, tool, args });
    if (!(tool in replies)) throw new Error("unexpected " + tool);
    const reply = replies[tool];
    const answer = typeof reply === "function" ? reply(args) : reply;
    if (answer instanceof Error) throw answer;
    return answer as never;
  });
};

const toolsCalled = () => calls.map((call) => call.tool);

const approval = (id: string, kind: string, decidedAt: string, summary = "Add the goal " + id, payload: unknown = "") => ({
  id,
  kind,
  summary,
  payload,
  status: "approved",
  decided_by: "Amos",
  decided_at: decidedAt,
});

const publication = (version: number, publishedAt: string, tag = "v" + version) => ({
  id: "p" + version,
  version,
  tag,
  channel: version === 1 ? "" : "production",
  published_at: publishedAt,
  document: { goals: [] },
});

const openDraft = { id: "d1", description: "Initial draft", status: "open" };

const readable = (over: Record<string, Reply> = {}): Record<string, Reply> => ({
  agency_list_drafts: { items: [openDraft] },
  agency_list_approvals: { items: [] },
  agency_list_publications: { items: [] },
  ...over,
});

describe("which pages carry the draft bar", () => {
  it("is the profile, goals, roles and risks pages of the agency", () => {
    for (const page of ["profile", "goals", "roles", "bowties", "modules"]) expect(showsDraftBar(page)).toBe(true);
  });

  it("is none of the other pages", () => {
    for (const page of ["status", "users", "groups", "agents", "approvals", "general", "models", "documents"]) expect(showsDraftBar(page)).toBe(false);
  });

  it("sends each kind of agency change to the page where the owner sees it", () => {
    expect(changePageOf("agency_create_goal")).toBe("goals");
    expect(changePageOf("agency_create_objective")).toBe("goals");
    expect(changePageOf("agency_create_role")).toBe("roles");
    expect(changePageOf("agency_update_role")).toBe("roles");
    expect(changePageOf("agency_update_agency")).toBe("profile");
  });

  it("knows no page for a kind of request that does not change the agency's definition", () => {
    for (const kind of ["instance_rename", "instance_set_join_mode", "sources_document_create", "actor_invite_to_group", "toString", ""])
      expect(changePageOf(kind)).toBeUndefined();
  });
});

describe("reading what is not published", () => {
  it("asks the open drafts, the approved requests and the publications of the hub", async () => {
    answerWith(readable());
    await loadDraft("h1");
    expect(calls).toEqual([
      { hubId: "h1", tool: "agency_list_drafts", args: { status: "open" } },
      { hubId: "h1", tool: "agency_list_approvals", args: { status: "approved" } },
      { hubId: "h1", tool: "agency_list_publications", args: {} },
    ]);
  });

  it("names the newest open draft, where an approved change lands", async () => {
    answerWith(
      readable({
        agency_list_drafts: {
          items: [
            { id: "old", description: "Shelved", status: "archived" },
            { id: "first", description: "Initial draft", status: "open" },
            { id: "second", description: "Imported", status: "open" },
            { id: "last", description: "Closed again", status: "archived" },
          ],
        },
      }),
    );
    expect((await loadDraft("h1")).draft).toEqual({ id: "second", description: "Imported" });
  });

  it("counts every approved goal, objective, role and profile change when nothing was ever published", async () => {
    answerWith(
      readable({
        agency_list_approvals: {
          items: [
            approval("a4", "agency_update_agency", "2026-10-27T10:04:00Z", "Rename this agency to Siaya Farmers"),
            approval("a3", "agency_create_role", "2026-10-27T10:03:00Z", "Add the role Treasurer"),
            approval("a2", "agency_create_objective", "2026-10-27T10:02:00Z", "Add the objective Buy seed"),
            approval("a1", "agency_create_goal", "2026-10-27T10:01:00Z", "Add the goal Grow maize"),
          ],
        },
      }),
    );
    const { changes, last } = await loadDraft("h1");
    expect(last).toBeNull();
    expect(changes.map((change) => change.id)).toEqual(["a4", "a3", "a2", "a1"]);
  });

  it("describes each change by its kind, its title, its summary, the page it belongs to, who approved it and when", async () => {
    answerWith(
      readable({
        agency_list_approvals: {
          items: [
            approval("a1", "agency_create_goal", "2026-10-27T10:01:00Z", "Add the goal Grow maize", JSON.stringify({ title: "Grow maize", description: "d" })),
            approval("a2", "agency_create_role", "2026-10-27T10:02:00Z", "Add the role Treasurer", JSON.stringify({ name: "Treasurer", description: "" })),
          ],
        },
      }),
    );
    expect((await loadDraft("h1")).changes).toEqual([
      { id: "a1", summary: "Add the goal Grow maize", title: "Grow maize", kindWord: "draft.kindGoal", page: "goals", decidedBy: "Amos", at: "2026-10-27T10:01:00Z" },
      { id: "a2", summary: "Add the role Treasurer", title: "Treasurer", kindWord: "draft.kindRole", page: "roles", decidedBy: "Amos", at: "2026-10-27T10:02:00Z" },
    ]);
  });

  it("names the kind of each of the four agency changes", async () => {
    answerWith(
      readable({
        agency_list_approvals: {
          items: [
            approval("a1", "agency_create_goal", "2026-10-27T10:01:00Z"),
            approval("a2", "agency_create_objective", "2026-10-27T10:02:00Z"),
            approval("a3", "agency_create_role", "2026-10-27T10:03:00Z"),
            approval("a4", "agency_update_agency", "2026-10-27T10:04:00Z"),
          ],
        },
      }),
    );
    const { changes } = await loadDraft("h1");
    expect(changes.map((change) => [change.kindWord, change.page])).toEqual([
      ["draft.kindGoal", "goals"],
      ["draft.kindObjective", "goals"],
      ["draft.kindRole", "roles"],
      ["draft.kindProfile", "profile"],
    ]);
  });

  it("reads the title of a change from a payload sent as JSON text or as JSON text wrapped in a string", async () => {
    const payload = JSON.stringify({ name: "Siaya Farmers" });
    answerWith(
      readable({
        agency_list_approvals: {
          items: [
            approval("a1", "agency_update_agency", "2026-10-27T10:01:00Z", "Rename this agency", payload),
            approval("a2", "agency_update_agency", "2026-10-27T10:02:00Z", "Rename this agency", JSON.stringify(payload)),
          ],
        },
      }),
    );
    expect((await loadDraft("h1")).changes.map((change) => change.title)).toEqual(["Siaya Farmers", "Siaya Farmers"]);
  });

  it("falls back on the summary as the title when the payload carries none", async () => {
    answerWith(
      readable({
        agency_list_approvals: {
          items: [
            approval("a1", "agency_create_goal", "2026-10-27T10:01:00Z", "Add the goal Grow maize", "not json"),
            approval("a2", "agency_create_goal", "2026-10-27T10:02:00Z", "Add the goal Sell maize", ""),
          ],
        },
      }),
    );
    expect((await loadDraft("h1")).changes.map((change) => change.title)).toEqual(["Add the goal Grow maize", "Add the goal Sell maize"]);
  });

  it("leaves out the requests decided before the newest publication", async () => {
    answerWith(
      readable({
        agency_list_approvals: {
          items: [
            approval("late", "agency_create_goal", "2026-10-27T12:00:00Z"),
            approval("early", "agency_create_goal", "2026-10-27T08:00:00Z"),
          ],
        },
        agency_list_publications: { items: [publication(1, "2026-10-27T07:00:00Z"), publication(2, "2026-10-27T09:00:00Z")] },
      }),
    );
    const { changes, last } = await loadDraft("h1");
    expect(changes.map((change) => change.id)).toEqual(["late"]);
    expect(last).toEqual({ version: 2, tag: "v2", at: "2026-10-27T09:00:00Z" });
  });

  it("takes the highest version as the last publication whatever the order of the list", async () => {
    answerWith(
      readable({
        agency_list_publications: { items: [publication(3, "2026-10-27T09:00:00Z"), publication(1, "2026-10-27T07:00:00Z"), publication(2, "2026-10-27T08:00:00Z")] },
      }),
    );
    expect((await loadDraft("h1")).last?.version).toBe(3);
  });

  it("does not count the requests that leave the agency's definition alone", async () => {
    answerWith(
      readable({
        agency_list_approvals: {
          items: [
            approval("rename", "instance_rename", "2026-10-27T10:00:00Z"),
            approval("join", "instance_set_join_mode", "2026-10-27T10:00:00Z"),
            approval("doc", "sources_document_create", "2026-10-27T10:00:00Z"),
            approval("invite", "actor_invite_to_group", "2026-10-27T10:00:00Z"),
            approval("goal", "agency_create_goal", "2026-10-27T10:00:00Z"),
          ],
        },
      }),
    );
    expect((await loadDraft("h1")).changes.map((change) => change.id)).toEqual(["goal"]);
  });

  it("counts nothing when no draft is open, since there is nowhere for a change to wait", async () => {
    answerWith(
      readable({
        agency_list_drafts: { items: [{ id: "old", description: "Shelved", status: "archived" }] },
        agency_list_approvals: { items: [approval("a1", "agency_create_goal", "2026-10-27T10:00:00Z")] },
      }),
    );
    const snapshot = await loadDraft("h1");
    expect(snapshot.draft).toBeNull();
    expect(snapshot.changes).toEqual([]);
  });

  it("reads a list the backend sends bare as well as wrapped", async () => {
    answerWith({
      agency_list_drafts: [openDraft],
      agency_list_approvals: [approval("a1", "agency_create_role", "2026-10-27T10:00:00Z")],
      agency_list_publications: [],
    });
    const snapshot = await loadDraft("h1");
    expect(snapshot.draft?.id).toBe("d1");
    expect(snapshot.changes).toHaveLength(1);
  });

  it("fails when the backend cannot be read, so the bar is not drawn from a guess", async () => {
    answerWith(readable({ agency_list_publications: new Error("wakala answered 500") }));
    await expect(loadDraft("h1")).rejects.toThrow("wakala answered 500");
  });

  it("reads the last publication alone for a request's detail", async () => {
    answerWith({ agency_list_publications: { items: [publication(4, "2026-10-27T09:30:00Z")] } });
    expect(await lastPublished("h1")).toEqual({ version: 4, tag: "v4", at: "2026-10-27T09:30:00Z" });
    expect(toolsCalled()).toEqual(["agency_list_publications"]);
  });

  it("says no publication when the agency was never published", async () => {
    answerWith({ agency_list_publications: { items: [] } });
    expect(await lastPublished("h1")).toBeNull();
  });
});

describe("whether a decision is still unpublished", () => {
  const last = { version: 2, tag: "v2", at: "2026-10-27T09:00:00Z" };

  it("is unpublished when the agency was never published", () => {
    expect(isUnpublished("2026-10-27T08:00:00Z", null)).toBe(true);
  });

  it("is unpublished when it was decided after the last publication", () => {
    expect(isUnpublished("2026-10-27T09:00:01Z", last)).toBe(true);
  });

  it("is published when it was decided before the last publication", () => {
    expect(isUnpublished("2026-10-27T08:59:59Z", last)).toBe(false);
  });

  it("is published when it was decided at the very moment of the last publication", () => {
    expect(isUnpublished("2026-10-27T09:00:00Z", last)).toBe(false);
  });

  it("is unpublished when a time cannot be read, so a change is never hidden", () => {
    expect(isUnpublished("", last)).toBe(true);
    expect(isUnpublished("2026-10-27T10:00:00Z", { ...last, at: "yesterday" })).toBe(true);
  });
});

describe("where the changes are listed", () => {
  it("is the Goals page of the hub asking for the changes", () => {
    expect(changesPath("h1")).toBe("/h/h1/goals?changes=1");
  });
});

describe("where a finding of the scan points", () => {
  it("points a goal finding at that goal on the Goals page", () => {
    expect(problemLink("h1", "goal", "g1")).toBe("/h/h1/goals?goal=g1");
  });

  it("points an objective finding at that objective on the Goals page", () => {
    expect(problemLink("h1", "objective", "o1")).toBe("/h/h1/goals?objective=o1");
  });

  it("points a role finding at that role on the Roles page", () => {
    expect(problemLink("h1", "role", "r1")).toBe("/h/h1/roles?open=r1");
  });

  it("points a finding about the agency itself at the Profile page", () => {
    expect(problemLink("h1", "agency", "")).toBe("/h/h1/profile");
  });

  it("points a goal finding with no id at the Goals page", () => {
    expect(problemLink("h1", "goal", "")).toBe("/h/h1/goals");
  });

  it("writes an awkward id and hub safely into the link", () => {
    expect(problemLink("a b", "role", "x&y=1")).toBe("/h/a%20b/roles?open=x%26y%3D1");
  });

  it("points nowhere for a thing the console has no page for", () => {
    for (const type of ["work_item", "value_attachment", "rule_attachment", "role_assignment", "event_flow_step", "", "toString"])
      expect(problemLink("h1", type, "x")).toBeUndefined();
  });
});

describe("scanning a draft", () => {
  it("scans the named draft and keeps the error findings as plain sentences with their links", async () => {
    answerWith({
      agency_list_issues: {
        items: [
          { id: "i1", severity: "error", message: 'Goal G-3 "Grow maize" has no Objectives', entity_type: "goal", entity_id: "g3" },
          { id: "i2", severity: "warning", message: "Something soft", entity_type: "goal", entity_id: "g3" },
          { id: "i3", severity: "info", message: "Something informative" },
          { id: "i4", severity: "error", message: "The Agency has no Goals", entity_type: "agency", entity_id: "" },
        ],
      },
    });
    expect(await scanDraft("h1", "d1")).toEqual([
      { message: 'Goal G-3 "Grow maize" has no Objectives', to: "/h/h1/goals?goal=g3", open: "draft.openGoal" },
      { message: "The Agency has no Goals", to: "/h/h1/profile", open: "draft.openProfile" },
    ]);
    expect(calls).toEqual([{ hubId: "h1", tool: "agency_list_issues", args: { draft_id: "d1" } }]);
  });

  it("keeps a workflow with no objective as a blocking sentence that opens the workflow", async () => {
    answerWith({
      agency_list_issues: {
        items: [
          { id: "i1", severity: "error", message: 'Workflow W-1 "Group order" has no Objective', entity_type: "workflow", entity_id: "w1" },
          { id: "i2", severity: "error", message: "workflow_objective wo1 points at a workflow that no longer exists", entity_type: "workflow_objective", entity_id: "wo1" },
        ],
      },
    });
    expect(await scanDraft("h1", "d1")).toEqual([
      { message: 'Workflow W-1 "Group order" has no Objective', to: "/h/h1/workflows?open=w1", open: "test.openWorkflow" },
      { message: "workflow_objective wo1 points at a workflow that no longer exists" },
    ]);
  });

  it("says how to open each kind of thing a finding is about", async () => {
    answerWith({
      agency_list_issues: {
        items: [
          { severity: "error", message: "a", entity_type: "objective", entity_id: "o1" },
          { severity: "error", message: "b", entity_type: "role", entity_id: "r1" },
          { severity: "error", message: "w", entity_type: "workflow", entity_id: "w1" },
          { severity: "error", message: "c", entity_type: "value_attachment", entity_id: "x" },
        ],
      },
    });
    const found = await scanDraft("h1", "d1");
    expect(found.map((problem) => problem.open)).toEqual(["draft.openObjective", "draft.openRole", "test.openWorkflow", undefined]);
    expect(found[3]).toEqual({ message: "c" });
  });

  it("finds nothing to fix in a draft whose scan gave only warnings", async () => {
    answerWith({ agency_list_issues: { items: [{ id: "i2", severity: "warning", message: "Soft" }] } });
    expect(await scanDraft("h1", "d1")).toEqual([]);
  });
});

describe("publishing a draft", () => {
  const clean = { agency_list_issues: { items: [] } };

  it("publishes the draft on the production channel once its scan is clean and answers the version, the label and the time", async () => {
    answerWith({
      ...clean,
      agency_publish_agency: { id: "p4", draft_id: "d1", version: 4, tag: "v4", channel: "production", published_at: "2026-10-27T10:30:00Z", document: {} },
    });
    expect(await publishDraft("h1", "d1")).toEqual({ published: { version: 4, tag: "v4", at: "2026-10-27T10:30:00Z" } });
    expect(toolsCalled()).toEqual(["agency_list_issues", "agency_publish_agency"]);
    expect(calls[1].args).toEqual({ draft_id: "d1", channel: "production" });
  });

  it("stops at the scan when it found an error and publishes nothing", async () => {
    answerWith({
      agency_list_issues: { items: [{ id: "i1", severity: "error", message: 'Goal G-3 "Grow maize" has no Objectives', entity_type: "goal", entity_id: "g3" }] },
      agency_publish_agency: { version: 9 },
    });
    expect(await publishDraft("h1", "d1")).toEqual({
      problems: [{ message: 'Goal G-3 "Grow maize" has no Objectives', to: "/h/h1/goals?goal=g3", open: "draft.openGoal" }],
    });
    expect(toolsCalled()).toEqual(["agency_list_issues"]);
  });

  it("turns a refusal that lists validation problems into one sentence each", async () => {
    answerWith({
      ...clean,
      agency_publish_agency: new Error(
        'agency_publish_agency: mwanachamaagency: agency has validation errors and cannot be published: The Agency has no Goals; Goal G-1 "A" has no Objectives',
      ),
    });
    expect(await publishDraft("h1", "d1")).toEqual({
      problems: [{ message: "The Agency has no Goals" }, { message: 'Goal G-1 "A" has no Objectives' }],
    });
  });

  it("says nothing changed when the backend refuses a document identical to the last published one", async () => {
    answerWith({ ...clean, agency_publish_agency: new Error("agency_publish_agency: mwanachamaagency: no changes detected since last publication") });
    expect(await publishDraft("h1", "d1")).toEqual({ problems: [{ message: "", word: "draft.noChanges" }] });
  });

  it("says the publish failed when the backend refuses for a reason it cannot read", async () => {
    answerWith({ ...clean, agency_publish_agency: new Error("agency_publish_agency: publication tag already exists") });
    expect(await publishDraft("h1", "d1")).toEqual({ problems: [{ message: "", word: "draft.publishFailed" }] });
  });

  it("says the publish failed when the scan itself could not be read", async () => {
    answerWith({ agency_list_issues: new Error("wakala answered 500: down"), agency_publish_agency: { version: 9 } });
    expect(await publishDraft("h1", "d1")).toEqual({ problems: [{ message: "", word: "draft.publishFailed" }] });
    expect(toolsCalled()).toEqual(["agency_list_issues"]);
  });
});

describe("the working draft of a hub", () => {
  const drafts = {
    items: [
      { id: "old", description: "Shelved", status: "archived" },
      { id: "first", description: "Initial draft", status: "open" },
      { id: "second", description: "Imported from Siaya Farmers' Group", status: "open" },
      { id: "last", description: "Closed again", status: "archived" },
    ],
  };

  it("is the newest open draft, because the drafts are listed oldest first", async () => {
    answerWith({ agency_list_drafts: drafts });
    expect(await workingDraftId("h1")).toBe("second");
  });

  it("asks only the open drafts of the hub", async () => {
    answerWith({ agency_list_drafts: drafts });
    await workingDraftId("h1");
    expect(calls).toEqual([{ hubId: "h1", tool: "agency_list_drafts", args: { status: "open" } }]);
  });

  it("is the only open draft when there is one", async () => {
    answerWith({ agency_list_drafts: { items: [openDraft] } });
    expect(await workingDraftId("h1")).toBe("d1");
  });

  it("reads a bare list of drafts as well as one wrapped in items", async () => {
    answerWith({ agency_list_drafts: drafts.items });
    expect(await workingDraftId("h1")).toBe("second");
  });

  it("skips an open draft that carries no id", async () => {
    answerWith({ agency_list_drafts: { items: [openDraft, { description: "Nameless", status: "open" }] } });
    expect(await workingDraftId("h1")).toBe("d1");
  });

  it("is empty when no draft is open", async () => {
    answerWith({ agency_list_drafts: { items: [{ id: "old", status: "archived" }] } });
    expect(await workingDraftId("h1")).toBe("");
  });

  it("is empty when the hub has no drafts at all", async () => {
    answerWith({ agency_list_drafts: { items: [] } });
    expect(await workingDraftId("h1")).toBe("");
  });

  it("is the draft the bar names and publishes", async () => {
    answerWith(readable({ agency_list_drafts: drafts }));
    expect((await loadDraft("h1")).draft?.id).toBe(await workingDraftId("h1"));
  });

  it("fails when the drafts cannot be read", async () => {
    answerWith({ agency_list_drafts: new Error("drafts are down") });
    await expect(workingDraftId("h1")).rejects.toThrow("drafts are down");
  });
});

describe("the draft an agency read is scoped to", () => {
  const drafts = { items: [{ id: "first", status: "open" }, { id: "second", status: "open" }] };

  it("names the working draft when the query names none", async () => {
    answerWith({ agency_list_drafts: drafts });
    expect(await draftScope("h1")).toEqual({ draft_id: "second" });
    expect(await draftScope("h1", { goal: "g1" })).toEqual({ draft_id: "second" });
  });

  it("names the draft in the query without asking for the drafts", async () => {
    answerWith({});
    expect(await draftScope("h1", { draft_id: "chosen" })).toEqual({ draft_id: "chosen" });
    expect(calls).toEqual([]);
  });

  it("names no draft when the query says there is none", async () => {
    answerWith({});
    expect(await draftScope("h1", { draft_id: "" })).toEqual({});
    expect(calls).toEqual([]);
  });

  it("names no draft, so the published agency is read, when none is open", async () => {
    answerWith({ agency_list_drafts: { items: [{ id: "old", status: "archived" }] } });
    expect(await draftScope("h1")).toEqual({});
  });

  it("fails when the drafts cannot be read", async () => {
    answerWith({ agency_list_drafts: new Error("drafts are down") });
    await expect(draftScope("h1")).rejects.toThrow("drafts are down");
  });
});
