import { messageOf } from "./api";

vi.mock("../../wakala/mcp", () => ({ callTool: vi.fn() }));
vi.mock("../../wakala/me", () => ({ loadSubject: vi.fn().mockResolvedValue("u1") }));

const posted = (extra: Record<string, unknown>) => ({ id: "m1", author_id: "u9", author_name: "Someone", body: "hi", created_at: "2026-11-02T09:00:00Z", ...extra });

describe("the Agent chip on a chat message", () => {
  it("is not given to an owner who holds no seat in the group", () => {
    expect(messageOf("u1")(posted({ author_admin: true, author_role: "" })).agent).toBe(false);
  });

  it("is not given to a message that names no author_kind", () => {
    expect(messageOf("u1")(posted({})).agent).toBe(false);
  });

  it("is not given to an author_kind other than agent", () => {
    expect(messageOf("u1")(posted({ author_kind: "person" })).agent).toBe(false);
  });

  it("is given to a message whose author_kind is agent, whatever the staff flag says", () => {
    expect(messageOf("u1")(posted({ author_kind: "agent", author_admin: false })).agent).toBe(true);
    expect(messageOf("u1")(posted({ author_kind: "agent", author_admin: true })).agent).toBe(true);
  });
});
