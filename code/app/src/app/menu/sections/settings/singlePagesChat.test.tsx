import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { AssistantPage } from "../../../../features/assistant/AssistantPage";
import { type AssistantClient } from "../../../../features/assistant/api";
import { routes as appRoutes } from "../../../routes";
import { carriedChatAbout, forgetChatAbout } from "../../../chatAbout";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const entries = [
  { id: "e1", actor: "a1", action: "granted a role", subject: "a2", at: "2026-11-12T14:30:00Z" },
  { id: "e3", actor: "a1", action: "added a row", subject: "", at: "2026-11-10T10:15:00Z" },
];

beforeEach(() => {
  openAgency("town");
  forgetChatAbout();
  setWide(true);
  vi.spyOn(mcp, "listTools").mockResolvedValue([]);
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    switch (name) {
      case "agency_list_mounts":
        return { modules: [{ module: "actor" }] };
      case "agency_get_my_roles":
        return { permissions: ["permission.override"] };
      case "agency_get_agency":
        return { name: "Riverside Office" };
      case "instance_get_languages":
        return { studio_default: "en", content: ["en", "sw"], content_default: "en" };
      case "audit_list_entries":
        return { items: entries };
      case "actor_get_actors":
        return { items: [{ id: "a1", display_name: "Asha Otieno" }, { id: "a2", display_name: "Bela Nagy" }] };
      case "forms_catalog_setting_read":
        return null;
      default:
        return { items: [] };
    }
  });
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const assistantClient: AssistantClient = { model: async () => "acc1", ask: async () => ({ text: "ok", lists: [] }) };

const openAt = (title: string, query = "") => {
  const path = items.find((item) => item.title === title)?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[`${path}${query}`]}>
      <Routes>
        {routes()}
        <Route path={appRoutes.assistant.pattern} element={<AssistantPage client={assistantClient} />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("the Agency Profile page", () => {
  it("has the Chat tab, and it opens the assistant about the agency", async () => {
    openAt("Agency Profile");
    await screen.findByRole("region", { name: "Name" });
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Riverside Office");
    expect(carriedChatAbout()).toEqual({ kind: "agency", id: "town", name: "Riverside Office" });
  });
});

describe("the Details of a record page", () => {
  it("opens the assistant about the chosen record, with the details on the page given to it", async () => {
    openAt("Details of a record", "?item=RC-1");
    const card = await screen.findByRole("region", { name: "Details" });
    await within(card).findByText("Tax number");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Businesses");
    const about = carriedChatAbout();
    expect(about?.kind).toBe("record-details");
    expect(about?.name).toBe("Businesses");
    expect(about?.extra?.details).toContain("Trading name (on, required)");
    expect(about?.extra?.details).toContain("Tax number (on, required)");
  });

  it("follows the list: the chat is about the record chosen on the left", async () => {
    openAt("Details of a record");
    await userEvent.click(await screen.findByRole("button", { name: /Residents/ }));
    const card = await screen.findByRole("region", { name: "Details" });
    await within(card).findByText("Phone");
    await userEvent.click(screen.getByRole("link", { name: "Chat" }));
    await screen.findByText("About Residents");
    expect(carriedChatAbout()?.name).toBe("Residents");
  });
});
