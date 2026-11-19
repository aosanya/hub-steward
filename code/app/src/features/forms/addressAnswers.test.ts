import { callTool } from "../../shared/wakala/mcp";
import { liveClient, type FormQuestion } from "./api";
import { filled, shown, threadLines, toAnswer } from "./answers";

vi.mock("../../shared/wakala/mcp", () => ({ callTool: vi.fn() }));

const mocked = callTool as any;

const q: FormQuestion = { id: "q1", prompt: "Which street needs to be closed?", answer_type: "address", required: true, options: [] };

describe("an address answer", () => {
  it("is sent as the words with the reference of the picked place", () => {
    expect(toAnswer(q, { q1: { text: "Fő tér 2", options: [], placeRef: "address:a1" } })).toEqual({ question_id: "q1", value_text: "Fő tér 2", place_ref: "address:a1" });
  });

  it("is sent as the words alone when typed", () => {
    expect(toAnswer(q, { q1: { text: "the car park", options: [], placeRef: "" } })).toEqual({ question_id: "q1", value_text: "the car park" });
  });

  it("counts as filled once it has words, and reads back as the words", () => {
    const draft = { q1: { text: "Fő tér", options: [], placeRef: "street:Fő tér" } };
    expect(filled(q, draft)).toBe(true);
    expect(shown(q, draft)).toBe("Fő tér");
    expect(threadLines([q], draft)).toEqual(["Which street needs to be closed?: Fő tér"]);
  });

  it("is not filled while empty", () => {
    expect(filled(q, {})).toBe(false);
  });
});

describe("the live forms client and an address question", () => {
  it("carries the allow free text setting of the question", async () => {
    mocked.mockResolvedValue({ items: [{ question: { id: "q1", prompt: "Where?", answer_type: "address", allow_free_text: true }, options: [] }] });
    const [loaded] = await liveClient.questions("f1");
    expect(loaded.allow_free_text).toBe(true);
  });
});
