import { afterEach, describe, expect, it, vi } from "vitest";
import * as mcp from "../wakala/mcp";
import { mcpInboxClient } from "./api";

afterEach(() => vi.restoreAllMocks());

const reply = (value: unknown) => vi.spyOn(mcp, "callTool").mockResolvedValue(value as never);

describe("notifications from the tool", () => {
  it("reads snake_case fields and marks one read when read_at is set", async () => {
    reply({
      items: [
        { id: "n1", event: "order.placed", subject_kind: "order", subject_id: "o1", names: { buyer: "Grace" }, created_at: "2026-10-01T08:00:00Z", read_at: "2026-10-01T09:00:00Z" },
      ],
    });
    expect(await mcpInboxClient.listNotifications()).toEqual([
      { id: "n1", event: "order.placed", subjectKind: "order", subjectId: "o1", structureId: "", names: { buyer: "Grace" }, createdAt: "2026-10-01T08:00:00Z", read: true },
    ]);
  });

  it("reads PascalCase fields too", async () => {
    reply({ items: [{ ID: "n2", Event: "e", SubjectKind: "k", SubjectID: "s", Names: { a: "b" }, CreatedAt: "t", ReadAt: null }] });
    expect(await mcpInboxClient.listNotifications()).toEqual([
      { id: "n2", event: "e", subjectKind: "k", subjectId: "s", structureId: "", names: { a: "b" }, createdAt: "t", read: false },
    ]);
  });

  it("reads the structure a notification belongs to in either spelling", async () => {
    reply({ items: [{ ID: "n3", StructureID: "st-1" }, { id: "n4", structure_id: "st-2" }] });
    const [pascal, snake] = await mcpInboxClient.listNotifications();
    expect([pascal.structureId, snake.structureId]).toEqual(["st-1", "st-2"]);
  });

  it("fills a notification missing every field with empty values", async () => {
    reply({ items: [{}, null] });
    const blank = { id: "", event: "", subjectKind: "", subjectId: "", structureId: "", names: {}, createdAt: "", read: false };
    expect(await mcpInboxClient.listNotifications()).toEqual([blank, blank]);
  });

  it("returns none when the reply has no items", async () => {
    reply({});
    expect(await mcpInboxClient.listNotifications()).toEqual([]);
  });

  it("asks comm_notification_list with no arguments", async () => {
    const spy = reply({ items: [] });
    await mcpInboxClient.listNotifications();
    expect(spy).toHaveBeenCalledWith("", "comm_notification_list", {});
  });

  it("lets a refused list reach the screen", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new mcp.McpError("not signed in", true));
    await expect(mcpInboxClient.listNotifications()).rejects.toThrow("not signed in");
  });
});

describe("marking read", () => {
  it("sends the ids and returns how many moved", async () => {
    const spy = reply({ marked: 2 });
    expect(await mcpInboxClient.markRead(["n1", "n2"])).toBe(2);
    expect(spy).toHaveBeenCalledWith("", "comm_notification_mark_read", { ids: ["n1", "n2"] });
  });

  it("reports zero when the tool does not say", async () => {
    reply({});
    expect(await mcpInboxClient.markRead(["n1"])).toBe(0);
  });
});

describe("invitations from the tool", () => {
  it("names the group and the inviter from the first field present", async () => {
    reply({
      items: [
        { id: "i1", group_name: "Alpha", inviter_name: "Grace", expires_in_days: 3 },
        { id: "i2", structure_name: "Beta", invited_by_name: "Peter", expires_in_days: "5" },
        { id: "i3", role_kind_name: "Gamma" },
      ],
    });
    expect(await mcpInboxClient.listInvitations()).toEqual([
      { id: "i1", groupName: "Alpha", inviterName: "Grace", expiresInDays: 3 },
      { id: "i2", groupName: "Beta", inviterName: "Peter", expiresInDays: 5 },
      { id: "i3", groupName: "Gamma", inviterName: "", expiresInDays: 0 },
    ]);
  });

  it("keeps a missing group name empty rather than printing undefined", async () => {
    reply({ items: [{ id: "i1" }] });
    const [invitation] = await mcpInboxClient.listInvitations();
    expect(invitation.groupName).toBe("");
    expect(invitation.inviterName).toBe("");
  });

  it("returns none when the reply has no items", async () => {
    reply({});
    expect(await mcpInboxClient.listInvitations()).toEqual([]);
  });

  it("accepts and declines by invitation_id", async () => {
    const spy = reply({});
    await mcpInboxClient.acceptInvitation("i1");
    await mcpInboxClient.declineInvitation("i2");
    expect(spy).toHaveBeenCalledWith("", "actor_accept_invitation", { invitation_id: "i1" });
    expect(spy).toHaveBeenCalledWith("", "actor_decline_invitation", { invitation_id: "i2" });
  });

  it("lets a refused accept reach the screen", async () => {
    vi.spyOn(mcp, "callTool").mockRejectedValue(new mcp.McpError("actor_accept_invitation: expired"));
    await expect(mcpInboxClient.acceptInvitation("i1")).rejects.toThrow("expired");
  });
});
