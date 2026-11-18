import { vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const personName = "Sample Resident A";

const answer = async (name: string) => {
  if (name === "agency_list_mounts") return { modules: [{ module: "actor" }, { module: "forms" }] };
  if (name === "agency_get_my_roles") return { permissions: ["member.view"] };
  if (name === "actor_list_actors") return { items: [{ id: "p1", display_name: personName, status: "active" }] };
  if (name === "actor_get_actor") return { id: "p1", display_name: personName, status: "active" };
  if (name === "actor_list_attribute_properties") return { items: [] };
  return { items: [] };
};

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  openAgency("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => answer(name));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  Reflect.deleteProperty(window, "matchMedia");
  vi.restoreAllMocks();
});

const openPersonPage = async (wide: boolean) => {
  setWide(wide);
  const path = items.find((item) => item.title === "All People")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  if (!wide) await userEvent.click(await screen.findByRole("button", { name: new RegExp(personName) }));
  await screen.findByText("Bills");
  return document.querySelector(".mw-detail") as HTMLElement;
};

const headingsOf = (page: HTMLElement) => Array.from(page.querySelectorAll("h2, h3")).map((heading) => heading.textContent);

describe("the resident page has one design on a phone and on a computer", () => {
  it.each([false, true])("titles the page with the name alone and no title band above the resident (wide: %s)", async (wide) => {
    const page = await openPersonPage(wide);
    expect(page.querySelector(".wf-head")).toBeNull();
    expect(page.querySelector("h2.wf-head")).toBeNull();
    expect(within(page).queryByText("All People")).toBeNull();
    expect(within(page).getByRole("heading", { level: 1, name: personName })).toBeTruthy();
    expect(page.querySelector(".wf-content")).toBeTruthy();
  });

  it("lists the same headings in the same order on a phone as on a computer", async () => {
    const phone = headingsOf(await openPersonPage(false));
    cleanup();
    const computer = headingsOf(await openPersonPage(true));
    expect(phone).toEqual(computer);
  });
});
