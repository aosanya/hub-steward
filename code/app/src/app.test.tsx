import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { forgetOpenAgency, openAgency } from "./agency/open";
import { tabs } from "./tabs";
import { BottomBar } from "./ui/BottomBar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Chip } from "./ui/Chip";
import { Field } from "./ui/Field";
import { ListRow, Rows } from "./ui/ListRow";
import { Shell } from "./ui/Shell";

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe("tab bar", () => {
  beforeEach(() => openAgency("walk-agency"));

  afterEach(() => {
    forgetOpenAgency();
    vi.restoreAllMocks();
  });

  it("renders the tabs from tabs.ts and marks the active one", () => {
    at("/");
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = nav.querySelectorAll("a");
    expect(links).toHaveLength(tabs.length);
    tabs.forEach((tab, i) => expect(links[i]).toHaveTextContent(tab.label));
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).not.toHaveAttribute("aria-current");
  });

  it("switches page on navigation", async () => {
    at("/");
    expect(screen.getByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Chat/ }));
    expect(screen.getByRole("heading", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chat/ })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("link", { name: /Inbox/ }));
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  it("holds Do Something, Chat and Inbox and keeps no Apps or Started tab", () => {
    expect(tabs.map((tab) => tab.label)).toEqual(["Do Something", "Chat", "Inbox"]);
  });

  it("draws three labels in the bar", () => {
    at("/");
    const bar = within(screen.getByRole("navigation", { name: "Main" }));
    expect(bar.getAllByRole("link").map((link) => link.textContent?.replace(/[^A-Za-z ]/g, ""))).toEqual(["Do Something", "Chat", "Inbox"]);
  });

  it("ends the agency's old started address on its Do Something", async () => {
    at("/a/other-agency/started");
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Started" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Do Something/ })).toHaveAttribute("href", "/a/other-agency/do-something");
    expect(screen.getByRole("link", { name: /Do Something/ })).toHaveAttribute("aria-current", "page");
  });

  it("ends the agency-less /started on the open agency's Do Something", async () => {
    at("/started");
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Do Something/ })).toHaveAttribute("href", "/a/walk-agency/do-something");
  });

  it("has no page at the old apps tab route", () => {
    at("/a/walk-agency/apps");
    expect(screen.queryByRole("heading", { name: "Apps" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Apps/ })).not.toBeInTheDocument();
  });

  it.each(["/profile", "/language", "/sign-out", "/a/walk-agency/apps"])("sends the unbuilt or retired path %s to the agency's Do Something with its tab bar", (path) => {
    at(path);
    expect(screen.getByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Do Something/ })).toHaveAttribute("aria-current", "page");
  });

  it("lands an agency's own address on its Do Something", async () => {
    at("/a/other-agency");
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Do Something/ })).toHaveAttribute("href", "/a/other-agency/do-something");
    expect(screen.getByRole("link", { name: /Do Something/ })).toHaveAttribute("aria-current", "page");
  });

  it("opens Do Something on the agency's do-something route", () => {
    at("/a/walk-agency/do-something");
    expect(screen.getByRole("heading", { name: "Do Something" })).toBeInTheDocument();
  });

  it("sends an unknown path to the agencies page when no agency is open", () => {
    forgetOpenAgency();
    at("/profile");
    expect(screen.getByRole("heading", { name: "Your agencies" })).toBeInTheDocument();
  });

  it("still opens a known route rather than the fallback", () => {
    at("/inbox");
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  it("opens straight onto a tab route", () => {
    at("/inbox");
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("aria-current", "page");
  });
});

describe("components", () => {
  it("renders the shell with a back button that fires", async () => {
    const back = vi.fn();
    render(
      <MemoryRouter>
        <Shell title="Detail" onBack={back}>
          <p>content</p>
        </Shell>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalled();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("renders list row, card, chip, buttons, field and bottom bar", async () => {
    const pick = vi.fn();
    render(
      <>
        <Card>card text</Card>
        <Rows>
          <ListRow title="Row title" meta="Row meta" end={<Chip tone="accent">New</Chip>} onClick={pick} />
        </Rows>
        <Field label="Name" error="Required" />
        <BottomBar>
          <Button>Cancel</Button>
          <Button kind="primary">Send</Button>
        </BottomBar>
      </>,
    );
    expect(screen.getByText("card text")).toBeInTheDocument();
    expect(screen.getByText("Row meta")).toBeInTheDocument();
    expect(screen.getByText("New")).toHaveClass("chip", "accent");
    await userEvent.click(screen.getByRole("button", { name: /Row title/ }));
    expect(pick).toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toHaveClass("btn", "primary");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("quiet");
  });
});
