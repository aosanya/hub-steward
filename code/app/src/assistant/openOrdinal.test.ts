import { describe, expect, it } from "vitest";
import type { Issue } from "../backlogs/api";
import { historyUpTo, type Item } from "./queue";
import type { ResultList } from "./results";

const issue = (id: string, title: string, key?: string): Issue => ({ id, key, title, description: "", status: "to-do", step: "To do", repo: "", topics: [], backlog: "", mark: "", rank: 1 });

const list = (id: string, title: string, issues: Issue[]): ResultList => ({ id, title, total: issues.length, issues });

const asked = (id: number, content: string): Item => ({ id, role: "user", content });

const answered = (id: number, content: string, lists: ResultList[]): Item => ({ id, role: "assistant", content, lists });

const blocked = list("2:0", "Blocked issues", [issue("u-1", "Fix the drift", "DEV-1"), issue("u-2", "Import the municipality", "DEV-2"), issue("u-3", "Record clips", "DEV-3")]);

const earlier = list("1:0", "Issues", [issue("u-9", "Another thing"), issue("u-8", "Something else")]);

describe("Open N in the history sent to the model", () => {
  it("names the second row of the list the person is looking at", () => {
    const items = [asked(1, "show blocked"), answered(2, "Here.", [blocked]), asked(3, "Open 2")];
    const sent = historyUpTo(items, 3);
    expect(sent[2].content).toContain("u-2");
    expect(sent[2].content).toContain("Import the municipality");
    expect(sent[2].content).toContain("Blocked issues");
  });

  it("uses the newest answer's list, not an earlier one", () => {
    const items = [asked(1, "show all"), answered(2, "Here.", [earlier]), asked(3, "show blocked"), answered(4, "Here.", [blocked]), asked(5, "open 1")];
    const sent = historyUpTo(items, 5);
    expect(sent[4].content).toContain("u-1");
    expect(sent[4].content).not.toContain("u-9");
  });

  it("leaves a message alone when it is not Open N or the row does not exist", () => {
    const items = [asked(1, "show blocked"), answered(2, "Here.", [blocked]), asked(3, "Open 7"), asked(4, "move 2 to Doing")];
    const sent = historyUpTo(items, 4);
    expect(sent[2].content).toBe("Open 7");
    expect(sent[3].content).toBe("move 2 to Doing");
  });

  it("leaves Open N alone when no list has been shown", () => {
    const sent = historyUpTo([asked(1, "Open 2")], 1);
    expect(sent[0].content).toBe("Open 2");
  });
});
