import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import { carriedChatAbout, carryChatAbout, forgetChatAbout } from "../../../app/chatAbout";
import { SmartBacklogPage } from "./SmartBacklogPage";
import type { RuleSet, SmartBacklogClient } from "./types";

beforeEach(() => {
  openAgency("hub-1");
  forgetChatAbout();
});

afterEach(() => {
  forgetOpenAgency();
  forgetChatAbout();
});

const set: RuleSet = { match: "all", rules: [{ field: "tag", operator: "has", value: "bug" }, { field: "step", operator: "is_not", value: "done" }] };

const smart = { read: async (id: string) => ({ id, name: "Open bugs", set, issues: 0 }) } as unknown as SmartBacklogClient;

const show = () =>
  render(
    <MemoryRouter initialEntries={["/a/hub-1/backlogs/open-bugs/smart"]}>
      <Routes>
        <Route path="/a/:agencyId/backlogs/:backlogId/smart" element={<SmartBacklogPage client={smart} issues={{ issues: async () => [], backlogs: async () => [] } as never} manage={{ mayManage: async () => false } as never} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the chat about a smart backlog page", () => {
  it("is about the smart backlog by its name, with its rules in words and no id in the words", async () => {
    show();
    await screen.findByText("Open bugs");
    carryChatAbout();
    const about = carriedChatAbout();
    expect(about?.kind).toBe("smart-backlog");
    expect(about?.id).toBe("open-bugs");
    expect(about?.name).toBe("Open bugs");
    expect(about?.extra?.details).toMatch(/Tag has bug/);
    expect(about?.extra?.details).toMatch(/matches all/);
  });
});
