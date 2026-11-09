import { taskTools } from "../../backlogs/api";
import { farmers, openApp, startInAgencies, stubWakala } from "../inAgency.test-support";

export { endInAgencies, farmers, openApp, startInAgencies, where } from "../inAgency.test-support";

type Raw = Record<string, unknown>;

export const states = ["To do", "Doing", "Waiting", "Done", "Cancelled"];

export const issueRow = (over: Raw): Raw => ({
  id: "t1",
  title: "Untitled",
  description: "",
  status: "pending",
  state: "To do",
  project_name: "mwanachama-docs",
  tags: [],
  rank: 1,
  ...over,
});

export const importIssue = issueRow({ id: "t1", title: "Import the boards", rank: 2, status: "blocked", project_name: "hub-steward-swe", tags: ["Docs"], description: "Read every board." });

export const docsIssue = issueRow({ id: "t2", title: "Write the manual", rank: 1, project_name: "mwanachama-docs", tags: ["Docs"] });

export const loaderIssue = issueRow({ id: "t3", title: "Write the loader", rank: 3, project_name: "hub-steward-swe", tags: ["Software"], description: "The script." });

export const issues = [importIssue, docsIssue, loaderIssue];

export const backlogWorld = (over: Record<string, (args: Record<string, unknown>) => unknown> = {}) =>
  stubWakala({
    [taskTools.list]: () => ({ items: issues }),
    [taskTools.states]: () => ({ items: states.map((name) => ({ name })) }),
    [taskTools.get]: (args) => issues.find((one) => one.id === args.taskID) ?? {},
    [taskTools.edges]: (args) => ({ items: args.vertex_id === "t1" ? [{ to_id: "t2" }, { to_id: "t3" }] : [] }),
    ...over,
  });

export const inFarmers = (path: string, over?: Parameters<typeof backlogWorld>[0]) => {
  const world = backlogWorld(over);
  openApp(`/a/${farmers.id}${path}`);
  return world;
};

export const beforeEachJourney = startInAgencies;
