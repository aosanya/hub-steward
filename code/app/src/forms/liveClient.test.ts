import { callTool } from "../wakala/mcp";
import { liveClient } from "./api";

vi.mock("../wakala/mcp", () => ({ callTool: vi.fn() }));

const mocked = callTool as any;

describe("the live forms client", () => {
  beforeEach(() => mocked.mockReset());

  it("names the sending group from the member's own groups", async () => {
    mocked.mockImplementation(async (_hub: string, tool: string) => {
      if (tool === "actor_list_my_groups") return { items: [{ id: "g1", name: "Kilimani Ward" }] };
      return {
        items: [
          { form_id: "a", title: "Borehole", originator_chapter_id: "g1", closes_at: "", questions: 1, answered: false, unanswered_as: [] },
          { form_id: "b", title: "Other", originator_chapter_id: "g9", closes_at: "", questions: 1, answered: false, unanswered_as: [] },
        ],
      };
    });
    const forms = await liveClient.waiting();
    expect(mocked).toHaveBeenCalledWith("", "forms_form_list_waiting");
    expect(mocked).toHaveBeenCalledWith("", "actor_list_my_groups", {});
    expect(forms.map((f) => f.group)).toEqual(["Kilimani Ward", undefined]);
  });

  it("still lists forms when the groups cannot be read", async () => {
    mocked.mockImplementation(async (_hub: string, tool: string) => {
      if (tool === "actor_list_my_groups") throw new Error("no");
      return { items: [{ form_id: "a", title: "Borehole", closes_at: "", questions: 1, answered: false, unanswered_as: [] }] };
    });
    expect((await liveClient.waiting()).map((f) => f.title)).toEqual(["Borehole"]);
  });

  it("reads max_files and require_capture off a question", async () => {
    mocked.mockResolvedValue({ items: [{ question: { id: "p", prompt: "Photo", answer_type: "photo", required: true, max_files: 3, require_capture: true }, options: [] }] });
    const [q] = await liveClient.questions("f1");
    expect(mocked).toHaveBeenCalledWith("", "forms_question_list", { form_id: "f1" });
    expect(q.max_files).toBe(3);
    expect(q.require_capture).toBe(true);
  });
});
