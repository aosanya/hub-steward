import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../wakala/mcp";
import { hubKinds } from "./hubKind";
import { pages } from "./registry";
import {
  buildMenu,
  crumbsOf,
  hiddenPages,
  hintKeys,
  isAgencyContentPage,
  pageIcon,
  pagesOf,
  reviewAreaPages,
  showsPage,
  type MenuGroup,
  type MenuRow,
} from "./menu";

vi.mock("../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const callToolMock = vi.mocked(callTool);

const translations: Record<string, Record<string, string>> = JSON.parse(readFileSync(resolve(__dirname, "../../public/i18n.json"), "utf8"));

const flat = (rows: MenuRow[]): MenuRow[] => rows.flatMap((row) => [row, ...flat(row.children ?? [])]);

const rowsOf = (groups: MenuGroup[]) => flat(groups.flatMap((group) => group.rows));

const idsOf = (groups: MenuGroup[]) => rowsOf(groups).map((row) => row.id);

const rowOf = (groups: MenuGroup[], id: string) => rowsOf(groups).find((row) => row.id === id);

beforeEach(() => {
  callToolMock.mockReset();
});

describe("the menu hints and rows", () => {
  it("keeps only the first Models suggestion while the hub has no model and every suggestion of other pages", () => {
    expect(hintKeys("models", false)).toEqual(["chat.models.1"]);
    expect(hintKeys("models", true)).toEqual(["chat.models.1", "chat.models.2", "chat.models.3"]);
    expect(hintKeys("groups", false)).toEqual(["chat.groups.1", "chat.groups.2", "chat.groups.3"]);
  });

  it("has no Limits, Overview, Members, Invite or AI roles row", () => {
    const ids = hubKinds.flatMap((kind) => idsOf(buildMenu(kind, "operations", {})));

    for (const gone of ["models-limits", "overview", "members", "invite", "ai-roles"]) expect(ids).not.toContain(gone);
  });
});

describe("the menu follows the kind of the hub", () => {
  it("shows a farmers' group Workflows and no Market section, Farm orders, Produce, Approvals, Operations, Documents nor Equipment", () => {
    const groups = buildMenu("farmers", "status", {});
    const ids = idsOf(groups);

    expect(groups.map((group) => group.caption)).not.toContain("menuMarket");
    for (const gone of ["suppliers", "products", "group-orders"]) expect(ids).not.toContain(gone);
    expect(ids).toContain("workflows");
    for (const absent of ["farm-orders", "produce", "approvals", "operations", "documents", "equipment"]) expect(ids).not.toContain(absent);
  });

  it("shows a lab Approvals, Operations with its sub-menu and Documents and no Equipment, Farm orders or Produce", () => {
    const ids = idsOf(buildMenu("lab", "operations", {}));

    expect(ids).toEqual(expect.arrayContaining(["approvals", "operations", "activity", "alerts", "documents"]));
    for (const absent of ["equipment", "farm-orders", "produce"]) expect(ids).not.toContain(absent);
  });

  it("shows a riders' hub Equipment and no Farm orders or Produce", () => {
    const ids = idsOf(buildMenu("riders", "operations", {}));

    expect(ids).toEqual(expect.arrayContaining(["equipment", "approvals", "documents"]));
    for (const absent of ["farm-orders", "produce"]) expect(ids).not.toContain(absent);
  });

  it("starts with Status, which has no caption, and ends with Settings under a divider", () => {
    const groups = buildMenu("farmers", "status", {});

    expect(groups[0]).toMatchObject({ caption: undefined, divided: false });
    expect(groups[0].rows.map((row) => row.id)).toEqual(["status"]);
    expect(groups.at(-1)).toMatchObject({ caption: "menuSettings", divided: true });
    expect(groups.at(-1)?.rows.map((row) => row.id)).toEqual(["general", "models"]);
  });

  it("lists the sections in the design's order and leaves out a section no page of the hub fills", () => {
    expect(buildMenu("farmers", "status", {}).map((group) => group.caption)).toEqual([
      undefined,
      "menuAgency",
      "menuUsersAgents",
      "menuSettings",
    ]);
    expect(buildMenu("lab", "status", {}).map((group) => group.caption)).toEqual([
      undefined,
      "menuAgency",
      "menuUsersAgents",
      "menuGenerated",
      "menuKnowledge",
      "menuSettings",
    ]);
  });

  it("knows which pages a kind shows", () => {
    expect(showsPage("farmers", "objectives")).toBe(true);
    expect(showsPage("lab", "objectives")).toBe(false);
    expect(showsPage("farmers", "produce")).toBe(false);
    expect(showsPage("lab", "agent-edit")).toBe(false);
    expect(pagesOf("farmers")).toContain("objectives");
    expect(pagesOf("farmers")).not.toContain("approvals");
  });
});

describe("the pages held back from the menu", () => {
  it("are in no menu, no page list and no hub kind, and the Operations sub-menu lists the others", () => {
    for (const kind of hubKinds) {
      const ids = hubKinds.flatMap((other) => idsOf(buildMenu(kind, "operations", {}).concat(buildMenu(other, "status", {}))));
      for (const page of hiddenPages) {
        expect(ids, `${kind} menu`).not.toContain(page);
        expect(pagesOf(kind), `${kind} pages`).not.toContain(page);
        expect(showsPage(kind, page), `${kind} shows`).toBe(false);
      }
    }
    const operations = rowOf(buildMenu("lab", "operations", {}), "operations")!;
    expect(operations.children?.map((child) => child.id)).toEqual(["network", "activity", "alerts"].filter((id) => !hiddenPages.includes(id)));
  });

  it("offer no suggestion while hidden", () => {
    expect(hiddenPages.length).toBeGreaterThan(0);
    for (const page of hiddenPages) {
      expect(hintKeys(page), page).toEqual([]);
      expect(hintKeys(page, false), page).toEqual([]);
    }
  });

  it("keep their crumb, icon and suggestions so bringing a page back is one line", () => {
    const held = hiddenPages.splice(0);
    try {
      for (const page of held) {
        expect(crumbsOf(page).last).toBe(page);
        expect(pageIcon(page)).not.toBe("chat");
        expect(hintKeys(page)).toHaveLength(3);
      }
    } finally {
      hiddenPages.push(...held);
    }
  });
});

describe("marking and counting rows", () => {
  it("marks the page that is open and no other row", () => {
    const current = rowsOf(buildMenu("lab", "groups", {})).filter((row) => row.current);

    expect(current.map((row) => row.id)).toEqual(["groups"]);
  });

  it("marks no row when the page is not in the menu", () => {
    expect(rowsOf(buildMenu("lab", "nowhere", {})).some((row) => row.current)).toBe(false);
  });

  it("puts the count of a page on its row as a badge and leaves it off a row with no count or a count of zero", () => {
    const groups = buildMenu("lab", "status", { approvals: 3, groups: 0 });

    expect(rowOf(groups, "approvals")?.badge).toBe(3);
    expect(rowOf(groups, "groups")).not.toHaveProperty("badge");
    expect(rowOf(groups, "users")).not.toHaveProperty("badge");
  });

  it("opens the Operations sub-menu while Operations or one of its pages is open", () => {
    const shown = ["network", "activity", "alerts"].filter((id) => !hiddenPages.includes(id));
    for (const page of ["operations", ...shown]) {
      const operations = rowOf(buildMenu("lab", page, {}), "operations")!;
      expect(operations.expanded, page).toBe(true);
      expect(operations.children?.map((child) => child.id), page).toEqual(shown);
    }
  });

  it("lists Review above Publish with a divider above Review and nothing beneath Publish, for every kind of hub", () => {
    for (const kind of hubKinds) {
      for (const page of ["publish", "publish-review", "status"]) {
        const rows = buildMenu(kind, page, {}).find(
          (group) => group.caption === "menuAgency",
        )!.rows;
        const ids = rows.map((row) => row.id);
        expect(ids.slice(-2), `${kind} ${page}`).toEqual([
          "publish-review",
          "publish",
        ]);
        expect(rows.at(-2), `${kind} ${page}`).toMatchObject({
          dividedBefore: true,
        });
        expect(rows.at(-1), `${kind} ${page}`).not.toHaveProperty(
          "dividedBefore",
        );
        expect(rows.at(-1), `${kind} ${page}`).not.toHaveProperty("children");
        expect(rows.at(-1), `${kind} ${page}`).not.toHaveProperty("expanded");
      }
    }
    expect(
      rowOf(buildMenu("farmers", "publish-review", {}), "publish-review")
        ?.current,
    ).toBe(true);
    expect(
      rowOf(buildMenu("farmers", "publish-review", {}), "publish"),
    ).not.toHaveProperty("current");
  });

  it("keeps the Review sub-menu closed away from Review", () => {
    for (const kind of hubKinds) {
      const review = rowOf(buildMenu(kind, "status", {}), "publish-review")!;
      expect(review.expanded, kind).toBe(false);
      expect(review, kind).not.toHaveProperty("children");
    }
  });

  it("opens the Review sub-menu on Review or on any of its area pages, with Objectives for farmers only", () => {
    const farmers = [
      "review-profile",
      "review-goals",
      "review-objectives",
      "review-roles",
      "review-workflows",
      "review-risks",
      "review-tests",
    ];
    const others = farmers.filter((id) => id !== "review-objectives");
    for (const [kind, expected] of [
      ["farmers", farmers],
      ["lab", others],
      ["riders", others],
    ] as const) {
      for (const page of ["publish-review", ...expected]) {
        const review = rowOf(buildMenu(kind, page, {}), "publish-review")!;
        expect(review.expanded, `${kind} ${page}`).toBe(true);
        expect(
          review.children?.map((child) => child.id),
          `${kind} ${page}`,
        ).toEqual(expected);
      }
    }
  });

  it("marks the open area page and not Review itself", () => {
    const groups = buildMenu("farmers", "review-risks", {});
    expect(rowOf(groups, "review-risks")?.current).toBe(true);
    expect(rowOf(groups, "publish-review")).not.toHaveProperty("current");
  });

  it("gives each Review area page the suggestions of Review", () => {
    for (const page of reviewAreaPages)
      expect(hintKeys(page), page).toEqual(hintKeys("publish-review"));
  });

  it("keeps the Review area pages out of the agency content pages", () => {
    for (const page of reviewAreaPages)
      expect(isAgencyContentPage(page), page).toBe(false);
    expect(isAgencyContentPage("goals")).toBe(true);
  });

  it("draws the crumb of a Review area page as Agency, Review and the area", () => {
    expect(crumbsOf("review-goals")).toEqual({
      section: "menuAgency",
      parent: "publish-review",
      last: "review-goals",
    });
  });

  it("collapses the Operations sub-menu elsewhere and adds the counts of its pages to the Operations row", () => {
    const operations = rowOf(buildMenu("lab", "status", { operations: 1, alerts: 2, activity: 4 }), "operations")!;

    expect(operations.expanded).toBe(false);
    expect(operations).not.toHaveProperty("children");
    expect(operations.badge).toBe(7);
  });

  it("keeps the counts on the sub-menu rows and not on Operations while the sub-menu is open", () => {
    const groups = buildMenu("lab", "alerts", { operations: 1, alerts: 2 });

    expect(rowOf(groups, "operations")?.badge).toBe(1);
    expect(rowOf(groups, "alerts")).toMatchObject({ badge: 2, current: true });
  });

  it("gives a page with no sub-menu no chevron, and none to Operations when no page of its sub-menu is shown", () => {
    expect(rowOf(buildMenu("lab", "status", {}), "approvals")).not.toHaveProperty("expanded");
    expect(rowOf(buildMenu("farmers", "status", {}), "operations")).toBeUndefined();
  });
});

describe("the page a chat or a crumb names", () => {
  it("draws the crumb as the section, the parent page and the page", () => {
    expect(crumbsOf("models")).toEqual({ section: "menuSettings", parent: undefined, last: "models" });
    expect(crumbsOf("network")).toEqual({ section: "menuGenerated", parent: "operations", last: "network" });
    expect(crumbsOf("status")).toEqual({ section: undefined, parent: undefined, last: "status" });
  });

  it("draws the crumb of the agent page as Users & Agents, Agents and the agent", () => {
    expect(crumbsOf("agent-edit")).toEqual({ section: "menuUsersAgents", parent: "agents", last: "agent-edit" });
  });

  it("draws a page the menu does not know as its own name", () => {
    expect(crumbsOf("constructor")).toEqual({ last: "constructor" });
  });

  it("gives the agent page the chat suggestions of the Agents page and a robot for its chip", () => {
    expect(hintKeys("agent-edit")).toEqual(hintKeys("agents"));
    expect(pageIcon("agent-edit")).toBe("robot");
    expect(pageIcon("status")).toBe("pulse");
  });

  it("gives a page the menu does not know a chat mark and no suggestion", () => {
    expect(pageIcon("nowhere")).toBe("chat");
    expect(hintKeys("nowhere")).toEqual([]);
  });
});

describe("the words of the menu", () => {
  it("are in every language the console has", () => {
    const keys = hubKinds.flatMap((kind) =>
      buildMenu(kind, "operations", {}).flatMap((group) => [...(group.caption ? [group.caption] : []), ...rowsOf([group]).map((row) => row.label)]),
    );
    const hints = pagesOf("riders").concat(pagesOf("lab"), pagesOf("farmers")).flatMap((page) => hintKeys(page));

    for (const [language, table] of Object.entries(translations)) {
      for (const key of [...keys, ...hints]) expect(table[key], `${language} lacks ${key}`).toBeTruthy();
    }
  });
});

describe("the pages of one model and of one agent", () => {
  it("keep Configure marked under the open Models row, with no row of their own, on every tab of a model", () => {
    const groups = buildMenu("farmers", "models", {}, "owner");
    expect(rowOf(groups, "models")?.expanded).toBe(true);
    expect(rowOf(groups, "models-configure")?.current).toBe(true);
    expect(rowsOf(groups).filter((row) => row.current)).toHaveLength(1);
  });

  it("agent-edit keeps its parent row marked in the menu", () => {
    const rows = buildMenu("farmers", "agent-edit", {}).flatMap((group) => group.rows);
    expect(rows.find((row) => row.id === "agents")?.current).toBe(true);
  });
});

describe("the pages the menu lists", () => {
  const routed = ["models", "models-configure", "assistant", "approvals", "usage", "usage-overview", "usage-work", "usage-agents"];
  const drawnNotBuilt = ["equipment"];
  const listed = [...new Set(hubKinds.flatMap(pagesOf))];

  it("each open a built page, except the ones the design draws and the console has not built", () => {
    const planned = listed.filter((id) => !routed.includes(id) && !reviewAreaPages.includes(id) && pages[id]?.spec?.id === undefined);

    expect(planned.sort()).toEqual([...drawnNotBuilt].sort());
  });

  it("never list the pages the design cut", () => {
    for (const gone of ["overview", "limits", "ai-roles", "members", "invite", "farm-orders", "produce"]) expect(listed).not.toContain(gone);
  });
});

describe("the Models rows in the menu", () => {
  it("open into Configure, Assistant and Usage, Usage opening into its three pages", () => {
    const models = rowOf(buildMenu("farmers", "usage-work", {}, "owner"), "models")!;
    expect(models.expanded).toBe(true);
    expect(models.children?.map((row) => row.id)).toEqual(["models-configure", "assistant", "usage"]);
    expect(models.children?.[2].children?.map((row) => row.id)).toEqual(["usage-overview", "usage-work", "usage-agents"]);
  });

  it("stay folded away from Models, with the chevron", () => {
    const models = rowOf(buildMenu("farmers", "general", {}, "owner"), "models")!;
    expect(models.expanded).toBe(false);
    expect(models.children).toBeUndefined();
  });

  it("show the owner an Assistant row under Models and keep it from a staff seat", () => {
    const ownerRows = rowOf(buildMenu("farmers", "assistant", {}, "owner"), "models")!;
    expect(ownerRows.children?.map((row) => row.id)).toContain("assistant");
    expect(rowOf(buildMenu("farmers", "assistant", {}, "owner"), "assistant")?.current).toBe(true);
    const staffRows = rowOf(buildMenu("farmers", "models", {}, "agent"), "models")!;
    expect(staffRows.children?.map((row) => row.id)).not.toContain("assistant");
  });

  it("show a staff seat Configure alone", () => {
    const models = rowOf(buildMenu("farmers", "models", {}, "agent"), "models")!;
    expect(models.children?.map((row) => row.id)).toEqual(["models-configure"]);
  });

  it("give Configure the hints of Models", () => {
    expect(hintKeys("models-configure", true)).toEqual(["chat.models.1", "chat.models.2", "chat.models.3"]);
    expect(hintKeys("models-configure", false)).toEqual(["chat.models.1"]);
  });
});

describe("the Usage pages in the menu", () => {
  it("open into Overview, Kind of work and Agents and people under Models", () => {
    const usage = rowOf(buildMenu("farmers", "usage-work", {}, "owner"), "usage")!;
    expect(usage.expanded).toBe(true);
    expect(usage.children?.map((row) => row.id)).toEqual(["usage-overview", "usage-work", "usage-agents"]);
    expect(usage.children?.find((row) => row.current)?.id).toBe("usage-work");
  });

  it("stay folded away from them, with the chevron", () => {
    const usage = rowOf(buildMenu("farmers", "models", {}, "owner"), "usage")!;
    expect(usage.expanded).toBe(false);
    expect(usage.children).toBeUndefined();
  });

  it("are not shown to a staff seat", () => {
    const ids = idsOf(buildMenu("farmers", "usage-work", {}, "agent"));
    expect(ids.filter((id) => id.startsWith("usage"))).toEqual([]);
    expect(ids).toContain("models");
  });
});
