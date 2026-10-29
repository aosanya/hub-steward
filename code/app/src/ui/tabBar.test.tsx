import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import type { InboxClient } from "../inbox/api";
import { TabBar } from "./TabBar";

const quietInbox = { listNotifications: () => Promise.resolve([]) } as unknown as InboxClient;

const open = () =>
  render(
    <MemoryRouter>
      <TabBar inbox={quietInbox} />
    </MemoryRouter>,
  );

const labels = () => screen.getAllByRole("link").map((link) => link.textContent?.replace(/[^A-Za-z ]/g, ""));

afterEach(() => forgetOpenAgency());

describe("tab bar", () => {
  it("shows Do Something, Chat and Inbox in that order", () => {
    open();
    expect(labels()).toEqual(["Do Something", "Chat", "Inbox"]);
  });

  it("points Do Something at the root when no agency is open", () => {
    open();
    expect(screen.getByRole("link", { name: /Do Something/ })).toHaveAttribute("href", "/");
  });

  it("has no Apps tab", () => {
    open();
    expect(screen.queryByRole("link", { name: /Apps/ })).not.toBeInTheDocument();
  });

  it("has no Started tab", () => {
    open();
    expect(screen.queryByRole("link", { name: /Started/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("points every tab at the open agency's own pages", () => {
    openAgency("walk-siaya");
    open();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/a/walk-siaya/do-something",
      "/a/walk-siaya/chat",
      "/a/walk-siaya/inbox",
    ]);
  });
});
