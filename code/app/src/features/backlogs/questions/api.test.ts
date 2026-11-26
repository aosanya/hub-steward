import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../../../shared/wakala/mcp";
import { mcpQuestionsClient, questionOf, questionTools } from "./api";

afterEach(() => vi.restoreAllMocks());

const raw = {
  id: "q1",
  code: "Q-14",
  kind: "question",
  title: "Which language should the imported agency open in?",
  body: "The template is in English.",
  status: "open",
  priority: "P1",
  target_role: "Product owner",
  answer: "",
  tags: ["hub-steward"],
  options: [
    { text: "Swahili first", recommended: false, reason: "" },
    { text: "English first", recommended: true, reason: "The template is written in English." },
  ],
};

describe("a question as the hub sends it", () => {
  it("keeps the code, the priority, the target role, the answer and the options with the recommended one first", () => {
    const question = questionOf(raw);
    expect(question).toMatchObject({ code: "Q-14", priority: "P1", targetRole: "Product owner", answer: "", tags: ["hub-steward"] });
    expect(question.options.map((one) => one.text)).toEqual(["English first", "Swahili first"]);
    expect(question.options[0]).toEqual({ text: "English first", recommended: true, reason: "The template is written in English." });
  });

  it("drops an option with no text and tolerates a question with no options at all", () => {
    expect(questionOf({ ...raw, options: [{ text: "", recommended: false }, { text: "Keep" }] }).options).toEqual([{ text: "Keep", recommended: false, reason: "" }]);
    expect(questionOf({ code: "Q-1" }).options).toEqual([]);
  });
});

describe("the questions client", () => {
  it("reads the open questions of one issue from the questions list of the rules-for-issue tool", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ linked: [], suggested: [], mentioned: [], questions: [raw] });
    const found = await mcpQuestionsClient.forIssue("issue-1");
    expect(call).toHaveBeenCalledWith("", questionTools.forIssue, { taskID: "issue-1" });
    expect(questionTools.forIssue).toBe("taskmanager_rule_list_for_issue");
    expect(found.map((one) => one.code)).toEqual(["Q-14"]);
  });

  it("answers with the index of an option, and sends nothing else", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({});
    await mcpQuestionsClient.answer("Q-14", { option: 1 });
    expect(call).toHaveBeenCalledWith("", questionTools.answer, { ruleCode: "Q-14", option: 1 });
  });

  it("answers with typed words as other, and sends nothing else", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({});
    await mcpQuestionsClient.answer("Q-14", { other: "Ask the council" });
    expect(call).toHaveBeenCalledWith("", questionTools.answer, { ruleCode: "Q-14", other: "Ask the council" });
  });

  it("files a question with its role, options and tags, then links it to the issue", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValueOnce({ code: "Q-20" }).mockResolvedValueOnce({});
    const code = await mcpQuestionsClient.ask!({
      title: "Which language?",
      body: "",
      targetRole: "Product owner",
      options: [{ text: "English", recommended: true, reason: "Template" }],
      tags: ["hub-steward"],
      issueId: "issue-1",
    });
    expect(code).toBe("Q-20");
    expect(call).toHaveBeenNthCalledWith(1, "", questionTools.create, {
      kind: "question",
      title: "Which language?",
      body: "",
      tags: ["hub-steward"],
      target_role: "Product owner",
      options: [{ text: "English", recommended: true, reason: "Template" }],
    });
    expect(call).toHaveBeenNthCalledWith(2, "", questionTools.link, { ruleCode: "Q-20", issue_id: "issue-1", relation: "applies_to" });
  });
});

describe("whether the caller holds the role a question targets", () => {
  it("holds a role named in the caller's roles, in any letter case, as a name or as an object", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ membership: "agent", roles: ["Product owner", { name: "Council" }] });
    const standing = await mcpQuestionsClient.standing();
    expect(standing.holds("product OWNER")).toBe(true);
    expect(standing.holds("council")).toBe(true);
    expect(standing.holds("Treasurer")).toBe(false);
  });

  it("gives the owner of the agency no exemption: the owner answers only a question for a role the owner holds", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ membership: "owner", roles: ["Product owner"] });
    const standing = await mcpQuestionsClient.standing();
    expect(standing.holds("Product owner")).toBe(true);
    expect(standing.holds("Treasurer")).toBe(false);
  });

  it("holds nothing when the roles cannot be read", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new Error("unreachable"));
    expect((await mcpQuestionsClient.standing()).holds("Product owner")).toBe(false);
  });
});

describe("reading one question and the questions of a backlog", () => {
  it("reads one question by its code through the rule read tool", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ rule: raw });
    const found = await mcpQuestionsClient.read("Q-14");
    expect(call).toHaveBeenCalledWith("", questionTools.read, { ruleCode: "Q-14" });
    expect(found.options.map((one) => one.text)).toEqual(["English first", "Swahili first"]);
    expect(found.targetRole).toBe("Product owner");
  });

  it("lists the questions of one backlog with the statuses asked for", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [raw, { code: "" }] });
    const found = await mcpQuestionsClient.list("b1", ["open"]);
    expect(call).toHaveBeenCalledWith("", questionTools.backlog, { backlogID: "b1", status: ["open"] });
    expect(found.map((one) => one.code)).toEqual(["Q-14"]);
  });

  it("lists the questions of every backlog through the rule list tool", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ items: [raw] });
    await mcpQuestionsClient.list("all", ["open", "answered"]);
    expect(call).toHaveBeenCalledWith("", questionTools.all, { kind: "question", status: ["open", "answered"] });
  });
});
