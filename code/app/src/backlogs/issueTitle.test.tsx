import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Issue } from "./api";
import { IssueLine, IssueTags, IssueTitle, lineWords, titleParts } from "./IssueTitle";
import { hueOf, shadeOf } from "./tags";

const issue = (over: Partial<Issue>): Issue => ({ id: "a", title: "t", description: "", status: "pending", step: "", repo: "", topics: [], backlog: "", mark: "", rank: 1, ...over });

describe("an issue's title on a row or card", () => {
  it("splits the code from the title at the first space when it looks like an id", () => {
    expect(titleParts("DEV-009 Create the party plane's structure tables")).toEqual({ code: "DEV-009", rest: "Create the party plane's structure tables" });
    expect(titleParts("SW59 Port the fixes")).toEqual({ code: "SW59", rest: "Port the fixes" });
    expect(titleParts("W74 Port the lock")).toEqual({ code: "W74", rest: "Port the lock" });
  });

  it("leaves a title with no id in front whole", () => {
    expect(titleParts("Create the tables")).toEqual({ code: "", rest: "Create the tables" });
    expect(titleParts("DEV-009")).toEqual({ code: "", rest: "DEV-009" });
  });

  it("shows the title as plain text without backticks or bold marks", () => {
    expect(titleParts("DEV-009 Create `chapter` and **role_kind**")).toEqual({ code: "DEV-009", rest: "Create chapter and role_kind" });
  });

  it("puts the code in its own span so it can take the accent colour", () => {
    render(<IssueTitle title="DEV-009 Create the tables" />);
    expect(screen.getByText("DEV-009")).toHaveClass("issue-code");
  });

  it("shows one bubble for each tag, three for three, and none for none", () => {
    const { container, rerender } = render(<IssueTags issue={issue({ repo: "hub-steward", topics: ["Docs"], backlog: "Backlog" })} chosen={[]} onTag={() => {}} />);
    expect(container.querySelectorAll(".chip")).toHaveLength(3);
    rerender(<IssueTags issue={issue({})} chosen={[]} onTag={() => {}} />);
    expect(container.querySelectorAll(".chip")).toHaveLength(0);
  });

  it("draws every tag, Ready and Blocked too, as the same pill with its own tint", () => {
    const { container } = render(<IssueTags issue={issue({ mark: "Blocked", repo: "hub-steward", topics: ["Docs"], backlog: "Backlog" })} chosen={[]} onTag={() => {}} />);
    const pills = Array.from(container.querySelectorAll(".issue-tags > *"));
    expect(pills.map((one) => one.textContent)).toEqual(["Blocked", "hub-steward", "Docs", "Backlog"]);
    expect(pills.every((one) => one.classList.contains("chip"))).toBe(true);
    expect(pills[0]).toHaveClass("danger");
    expect(pills[3]).toHaveClass("hued");
    expect(container.textContent).toBe("Blockedhub-stewardDocsBacklog");
  });

  it("names the repo once by its last path segment, and drops the backlog when it reads the same", () => {
    expect(lineWords(issue({ repo: "projects/hub-steward-agency_creator", backlog: "Backlog" }))).toEqual([
      { tag: "projects/hub-steward-agency_creator", label: "hub-steward-agency_creator" },
      { tag: "Backlog", label: "Backlog" },
    ]);
    expect(lineWords(issue({ repo: "backlog", backlog: "backlog" })).map((word) => word.label)).toEqual(["backlog"]);
    expect(lineWords(issue({}))).toEqual([]);
  });

  it("gives two row bubbles that read the same the same colour, whatever repo path stands behind them", () => {
    const hueOnRow = (repo: string) => {
      const { container } = render(<IssueLine issue={issue({ repo, backlog: "Backlog" })} chosen={[]} />);
      return container.querySelector<HTMLElement>(".chip")?.style.getPropertyValue("--hue");
    };
    expect(hueOnRow("projects/hub-steward-swe")).toBe(hueOnRow("hub-steward-swe"));
    expect(hueOnRow("hub-steward-swe")).toBe(String(hueOf("hub-steward-swe")));
  });

  it("colours a generated bubble only in the greens and blues, the reds are kept for Blocked", () => {
    const words = ["hub-steward-swe", "Backlog", "mwanachama-frontend-kazi", "meta-global-ai-hackathon-community-hubs", "Docs", "a", "zz", "projects/hub-steward-swe"];
    const sample = Array.from({ length: 720 }, (_, at) => `tag-${at}`);
    for (const word of [...words, ...sample]) {
      const hue = hueOf(word);
      expect(hue).toBeGreaterThanOrEqual(100);
      expect(hue).toBeLessThan(255);
    }
  });

  it("varies the shade of a bubble as well as its hue, from its text, in five steps", () => {
    const sample = Array.from({ length: 720 }, (_, at) => `tag-${at}`);
    const shades = new Set(sample.map(shadeOf));
    expect([...shades].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(shadeOf("hub-steward-swe")).toBe(shadeOf("hub-steward-swe"));
    const hues = new Set(sample.map(hueOf));
    expect(hues.size).toBeGreaterThan(100);
    expect(Math.abs(hueOf("hub-steward-swe") - hueOf("Backlog"))).toBeGreaterThanOrEqual(60);
    const { container } = render(<IssueLine issue={issue({ repo: "hub-steward-swe", backlog: "Backlog" })} chosen={[]} />);
    const first = container.querySelector<HTMLElement>(".chip");
    expect(first?.style.getPropertyValue("--shade")).toBe(String(shadeOf("hub-steward-swe")));
  });

  it("colours a bubble from its own text, the same every time, and leaves Ready and Blocked their tones", () => {
    expect(hueOf("hub-steward-swe")).toBe(hueOf("hub-steward-swe"));
    expect(hueOf("hub-steward-swe")).not.toBe(hueOf("Backlog"));
    const { container } = render(<IssueTags issue={issue({ mark: "Ready", repo: "hub-steward-swe", backlog: "Backlog" })} chosen={[]} />);
    const pills = Array.from(container.querySelectorAll<HTMLElement>(".issue-tags > *"));
    expect(pills[0]).toHaveClass("success");
    expect(pills[1].style.getPropertyValue("--hue")).toBe(String(hueOf("hub-steward-swe")));
  });
});
