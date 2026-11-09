import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { AgencyClient } from "../agency/modules";
import type { InboxClient } from "../inbox/api";
import { TabBar } from "./TabBar";

const quietInbox = { listNotifications: () => Promise.resolve([]) } as unknown as InboxClient;

const agencyWith = (...codes: string[]): AgencyClient => ({
  read: () => Promise.resolve({ name: "Siaya", modules: codes.map((code) => ({ code, name: code })) }),
});

const open = (path = "/a/walk-siaya/home", agency = agencyWith()) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar inbox={quietInbox} agency={agency} />
    </MemoryRouter>,
  );

const labels = () => screen.getAllByRole("link").map((link) => link.textContent?.replace(/[^A-Za-z ]/g, ""));

afterEach(() => forgetOpenAgency());

describe("tab bar", () => {
  it("shows Home, Chat, Do Something and Inbox in that order on the home screen", () => {
    open();
    expect(labels()).toEqual(["Home", "Chat", "Do Something", "Inbox"]);
  });

  it("keeps the home bar on Chat and the Inbox", () => {
    open("/a/walk-siaya/chat");
    expect(labels()).toEqual(["Home", "Chat", "Do Something", "Inbox"]);
  });

  it("points Home and Do Something at their retired paths when no agency is open", () => {
    open("/");
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Do Something/ })).toHaveAttribute("href", "/do-something");
  });

  it("has no Apps tab and no Started tab", () => {
    open();
    expect(screen.queryByRole("link", { name: /Apps|Started/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("points every tab at the open agency's own pages", () => {
    openAgency("walk-siaya");
    open();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/a/walk-siaya/home",
      "/a/walk-siaya/chat",
      "/a/walk-siaya/do-something",
      "/a/walk-siaya/inbox",
    ]);
  });

  it.each(["do-something", "ongoing", "backlogs", "backlogs/all"])("shows Home, Start and Ongoing on %s, and Backlogs once the task module is on", async (segment) => {
    openAgency("walk-siaya");
    open(`/a/walk-siaya/${segment}`, agencyWith("taskmanager"));
    expect(await screen.findByRole("link", { name: /Backlogs/ })).toBeInTheDocument();
    expect(labels()).toEqual(["Home", "Start", "Ongoing", "Backlogs"]);
  });

  it("leaves Backlogs out while the task module is off", async () => {
    openAgency("walk-siaya");
    open("/a/walk-siaya/ongoing", agencyWith("market"));
    expect(await screen.findByRole("link", { name: /Ongoing/ })).toBeInTheDocument();
    expect(labels()).toEqual(["Home", "Start", "Ongoing"]);
  });

  it("leaves Backlogs out when the modules could not be read", async () => {
    openAgency("walk-siaya");
    open("/a/walk-siaya/do-something", { read: () => Promise.reject(new Error("down")) });
    expect(await screen.findByRole("link", { name: /Start/ })).toBeInTheDocument();
    expect(labels()).toEqual(["Home", "Start", "Ongoing"]);
  });

  it("marks Start on the Do Something page and Backlogs on a backlog's board", async () => {
    openAgency("walk-siaya");
    open("/a/walk-siaya/backlogs/all", agencyWith("taskmanager"));
    expect(await screen.findByRole("link", { name: /Backlogs/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Start/ })).not.toHaveAttribute("aria-current");
  });
});
