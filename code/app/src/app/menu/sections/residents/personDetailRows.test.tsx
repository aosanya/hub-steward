import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { settingReply, type Settings } from "../../settingsFake";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Item = Record<string, unknown>;

let people: Item[];
const settings: Settings = {};

const attributeProperties = [
  { name: "phone", label: "Phone", range: "text", unique: true, required: false },
  { name: "email", label: "Email", range: "text", unique: true, required: false },
];

const hub = () => {
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    const setting = settingReply(settings, tool, args);
    if (setting !== undefined) return setting;
    if (tool === "agency_get_my_roles") return { permissions: ["member.add", "member.edit", "member.view", "member.read"] };
    if (tool === "actor_list_actors") return { items: people };
    if (tool === "actor_get_actor") return people.find((person) => person.id === given.actor_id);
    if (tool === "actor_list_attribute_properties") return { items: attributeProperties };
    return { items: [] };
  });
};

const openCard = async (id: string) => {
  const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[`${path}?person=${id}`]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  return screen.findByRole("region", { name: "Personal detail" });
};

beforeEach(() => {
  openAgency("town");
  hub();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Personal detail card", () => {
  it("opens with Name, then Email, then Phone, then the other details", async () => {
    people = [{ id: "p1", display_name: "Szabó Katalin", status: "active", attributes: { phone: "+36 20 555 1001", email: "katalin.szabo@example.invalid" } }];
    const card = await openCard("p1");
    const text = await within(card).findByText("katalin.szabo@example.invalid");
    expect(text).toBeInTheDocument();
    const shown = card.textContent ?? "";
    const order = ["Name", "Szabó Katalin", "Email", "katalin.szabo@example.invalid", "Phone", "+36 20 555 1001"].map((word) => shown.indexOf(word));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("is never empty for a resident who has a name but no email or phone on file", async () => {
    people = [{ id: "p2", display_name: "Takács Erzsébet", status: "active", attributes: { ward: "Kertváros" } }];
    const card = await openCard("p2");
    expect(await within(card).findByText("Takács Erzsébet")).toBeInTheDocument();
    expect(within(card).queryByText("No details on file yet.")).toBeNull();
    expect(within(card).queryByText("Email")).toBeNull();
  });

  it("keeps the empty line only for a resident with no name at all", async () => {
    people = [{ id: "p3", display_name: "", status: "active", attributes: {} }];
    const card = await openCard("p3");
    expect(await within(card).findByText("No details on file yet.")).toBeInTheDocument();
  });
});
