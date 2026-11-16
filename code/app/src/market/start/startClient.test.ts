import * as mcp from "../../wakala/mcp";
import { draftOf, isGroupOrderStart, isLiveBuyOrder, mcpStartClient, stepOf, unitOf, type StartQuestion } from "./api";

afterEach(() => vi.restoreAllMocks());

const raw = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  kind: "fill_form",
  title: "Create a group order",
  form_name: "Create group order",
  role_name: "Coordinator",
  workflow_name: "Group buying",
  questions: [
    { prompt: "Product", answer_type: "free_text", helper: "Name it", required: true },
    { prompt: "Price", answer_type: "currency", helper: "" },
    { prompt: "Minimum", answer_type: "number", helper: "", options: ["10", "20"] },
  ],
  ...over,
});

const asked = (...types: string[]): StartQuestion[] => types.map((answerType) => ({ prompt: answerType, answerType, helper: "" }));

describe("a step read from the hub", () => {
  it("keeps the words, marks only a required question and keeps options only when there are some", () => {
    const step = stepOf("Farmers")(raw());
    expect(step).toMatchObject({ id: "s1", title: "Create a group order", formName: "Create group order", roleName: "Coordinator", workflowName: "Group buying", agencyName: "Farmers", opensIn: "form" });
    expect(step.questions[0]).toEqual({ prompt: "Product", answerType: "free_text", helper: "Name it", required: true });
    expect(step.questions[1]).toEqual({ prompt: "Price", answerType: "currency", helper: "" });
    expect(step.questions[2].options).toEqual(["10", "20"]);
  });

  it("opens in chat only when the hub says chat, and survives an empty row", () => {
    expect(stepOf("")(raw({ opens_in: "chat" })).opensIn).toBe("chat");
    expect(stepOf("")(raw({ opens_in: "anything" })).opensIn).toBe("form");
    expect(stepOf("A")({})).toMatchObject({ id: "", title: "", questions: [], agencyName: "A" });
  });
});

describe("the group order start", () => {
  it("is a start only when it asks for words, a price and a number", () => {
    const step = (types: string[]) => ({ ...stepOf("")(raw()), questions: asked(...types) });
    expect(isGroupOrderStart(step(["free_text", "currency", "number"]))).toBe(true);
    expect(isGroupOrderStart(step(["free_text", "currency"]))).toBe(false);
    expect(isGroupOrderStart(step([]))).toBe(false);
  });

  it("puts KES before a price and bags after a number, and nothing on words", () => {
    expect(unitOf("currency")).toEqual({ unitBefore: "KES" });
    expect(unitOf("number")).toEqual({ unitAfter: "bags" });
    expect(unitOf("free_text")).toEqual({});
  });

  it("reads the draft from the answers in the order the questions are asked", () => {
    const questions = asked("number", "free_text", "currency");
    expect(draftOf(questions, ["20", "  Urea 50kg ", "4,100"])).toEqual({ product: "Urea 50kg", price: 4100, minimum: 20 });
  });

  it("reads letters as not a number and an unanswered number as zero, neither of which is above zero", () => {
    const draft = draftOf(asked("free_text", "currency", "number"), ["Urea", "abc"]);
    expect(draft.product).toBe("Urea");
    expect(draft.price).toBeNaN();
    expect(draft.minimum).toBe(0);
    expect(draft.price > 0 || draft.minimum > 0).toBe(false);
  });

  it("counts a buy order as live only while it is open or revising", () => {
    expect(isLiveBuyOrder({ direction: "buy", state: "open" })).toBe(true);
    expect(isLiveBuyOrder({ direction: "buy", state: "revising" })).toBe(true);
    expect(isLiveBuyOrder({ direction: "buy", state: "closed" })).toBe(false);
    expect(isLiveBuyOrder({ direction: "sell", state: "open" })).toBe(false);
    expect(isLiveBuyOrder(null)).toBe(false);
  });
});

describe("the start client", () => {
  const replyTo = (steps: unknown[]) =>
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, tool: string) => (tool === "agency_list_my_open_steps" ? { items: steps } : tool === "agency_get_agency" ? { name: "Farmers" } : {}));

  it("waiting lists only the group order starts, with the agency's name", async () => {
    replyTo([raw(), raw({ id: "s2", questions: asked("free_text") }), raw({ id: "s3", kind: "chat" })]);
    const steps = await mcpStartClient.waiting();
    expect(steps.map((s) => s.id)).toEqual(["s1"]);
    expect(steps[0].agencyName).toBe("Farmers");
  });

  it("waiting still lists the steps when the agency's name cannot be read", async () => {
    vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, tool: string) => {
      if (tool === "agency_get_agency") throw new Error("no");
      return { items: [raw()] };
    });
    const steps = await mcpStartClient.waiting();
    expect(steps).toHaveLength(1);
    expect(steps[0].agencyName).toBe("");
  });

  it("openSteps keeps form steps with questions and chat steps that open in chat", async () => {
    replyTo([raw(), raw({ id: "c1", kind: "chat", opens_in: "chat", questions: [] }), raw({ id: "c2", kind: "chat", opens_in: "form", questions: [] }), raw({ id: "f2", questions: [] })]);
    const steps = await mcpStartClient.openSteps();
    expect(steps.map((s) => s.id)).toEqual(["s1", "c1"]);
  });

  it("poster is the one the hub names", async () => {
    vi.spyOn(mcp, "callTool").mockResolvedValue({ poster_id: "p1", poster_name: "Kisumu Grain" });
    expect(await mcpStartClient.poster()).toEqual({ kind: "one", poster: { id: "p1", name: "Kisumu Grain" } });
  });

  it("poster is a choice among the approved ones when the hub names none, and none when there is at most one", async () => {
    const lists = (posters: unknown[]) =>
      vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, tool: string) => {
        if (tool === "market_get_group_order_poster") throw new Error("none");
        return { items: posters };
      });
    lists([{ id: "a", name: "A", status: "approved" }, { id: "b", name: "B", status: "approved" }, { id: "c", name: "C", status: "pending" }]);
    expect(await mcpStartClient.poster()).toEqual({ kind: "several", posters: [{ id: "a", name: "A" }, { id: "b", name: "B" }] });
    vi.restoreAllMocks();
    lists([{ id: "a", name: "A", status: "approved" }]);
    expect(await mcpStartClient.poster()).toEqual({ kind: "none" });
  });

  it("start sends the poster and the draft and returns the new id", async () => {
    const call = vi.spyOn(mcp, "callTool").mockResolvedValue({ id: "g9" });
    const out = await mcpStartClient.start({ product: "Urea", price: 4100, minimum: 20, posterId: "p1" });
    expect(out).toEqual({ id: "g9" });
    expect(call).toHaveBeenCalledWith("", "market_start_group_order", { poster_id: "p1", product: "Urea", price: 4100, minimum: 20 });
  });
});
