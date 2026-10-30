import { describe, expect, it, vi } from "vitest";
import { inFamily, toolFamilyOf } from "./chatTools";

vi.mock("./features", () => ({
  measuresOn: true,
  withoutMeasuresOff: (tools: string[]) => tools,
}));

const offered = (page: string, tool: string) =>
  inFamily(tool, toolFamilyOf(page));

describe("the tools each page's chat is offered", () => {
  it("lets the General chat read the groups and their join requests behind a joining change", () => {
    for (const tool of [
      "agency_get_agency",
      "instance_get_join_mode",
      "actor_list_groups",
      "actor_get_group",
      "actor_list_join_requests_for_group",
      "actor_list_actors_for_group",
    ]) {
      expect(offered("general", tool)).toBe(true);
    }
  });

  it("keeps the General chat away from the writes of the people tools", () => {
    for (const tool of [
      "actor_set_group_join_mode",
      "actor_invite_to_group",
      "actor_create_group",
    ]) {
      expect(offered("general", tool)).toBe(false);
    }
  });

  it("lets the Objectives and Publish chats read the agency's goals, objectives, measures and roles", () => {
    for (const page of ["objectives", "publish"]) {
      for (const tool of [
        "agency_get_agency",
        "agency_list_goals",
        "agency_list_objectives",
        "agency_get_objective",
        "agency_list_measures",
        "agency_list_roles",
      ]) {
        expect(offered(page, tool)).toBe(true);
      }
    }
  });

  it("lets the Documents chat read the rooms, the messages, the members and the roles behind an answer log", () => {
    for (const tool of [
      "sources_source_list",
      "sources_chunk_list",
      "comm_chat_thread_list",
      "comm_chat_message_list",
      "actor_list_actors",
      "agency_list_roles",
    ]) {
      expect(offered("documents", tool)).toBe(true);
    }
  });

  it("lets the Agents chat read the groups and the waiting requests behind a skipped agent", () => {
    for (const tool of [
      "ai_list_roles",
      "ai_list_accounts",
      "ai_get_role",
      "actor_list_groups",
      "comm_chat_thread_list",
    ]) {
      expect(offered("agents", tool)).toBe(true);
    }
  });

  it("keeps the Agents chat away from the message bodies", () => {
    expect(offered("agents", "comm_chat_message_list")).toBe(false);
  });
});
