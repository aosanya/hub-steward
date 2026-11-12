import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "./App";
import { forgetOpenAgency, openAgency } from "./agency/open";
import { mainBar } from "./tabs";
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

function Where({ seen }: { seen: string[] }) {
  const { pathname, search } = useLocation();
  seen.push(`${pathname}${search}`);
  return null;
}

const barLabels = () =>
  within(screen.getByRole("navigation", { name: "Main" }))
    .getAllByRole("link")
    .map((link) => link.textContent?.replace(/[^A-Za-z ]/g, ""));

describe("tab bar", () => {
  beforeEach(() => openAgency("walk-agency"));

  afterEach(() => {
    forgetOpenAgency();
    vi.restoreAllMocks();
  });

  it("renders the home bar from tabs.ts and marks the active one", () => {
    at("/");
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = nav.querySelectorAll("a");
    expect(links).toHaveLength(mainBar.length);
    mainBar.forEach((tab, i) => expect(links[i]).toHaveTextContent(tab.label));
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).not.toHaveAttribute("aria-current");
  });

  it("switches page on navigation", async () => {
    at("/");
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Chat/ }));
    expect(screen.getByRole("heading", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chat/ })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("link", { name: /Notifications/ }));
    expect(await screen.findByRole("link", { name: /Notifications/ })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("link", { name: /Home/ }));
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the same bar on Start and Ongoing, with none chosen", async () => {
    at("/a/walk-agency/do-something");
    expect(await screen.findByRole("heading", { name: "Start" })).toBeInTheDocument();
    expect(barLabels()).toEqual(["Home", "Chat", "Notifications"]);
    within(screen.getByRole("navigation", { name: "Main" }))
      .getAllByRole("link")
      .forEach((link) => expect(link).not.toHaveAttribute("aria-current"));
  });

  it("holds Home, Chat and Notifications and keeps no Inbox, Apps, Started or Do Something tab", () => {
    expect(mainBar.map((tab) => tab.label)).toEqual(["Home", "Chat", "Notifications"]);
  });

  it("draws three labels in the bar", () => {
    at("/");
    expect(barLabels()).toEqual(["Home", "Chat", "Notifications"]);
  });

  it("draws the inbox as the home screen", () => {
    at("/a/walk-agency/home");
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Inbox" })).not.toBeInTheDocument();
  });

  it("sends the agency's old started address to its Ongoing screen", async () => {
    const seen: string[] = [];
    render(
      <MemoryRouter initialEntries={["/a/other-agency/started"]}>
        <App />
        <Where seen={seen} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(seen.at(-1)).toBe("/a/other-agency/ongoing");
    expect(screen.queryByRole("heading", { name: "Started" })).not.toBeInTheDocument();
    expect(barLabels()).toEqual(["Home", "Chat", "Notifications"]);
  });

  it("sends the agency-less /started to the open agency's Ongoing screen", async () => {
    const seen: string[] = [];
    render(
      <MemoryRouter initialEntries={["/started"]}>
        <App />
        <Where seen={seen} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(seen.at(-1)).toBe("/a/walk-agency/ongoing");
  });

  it("has no page at the old apps tab route", () => {
    at("/a/walk-agency/apps");
    expect(screen.queryByRole("heading", { name: "Apps" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Apps/ })).not.toBeInTheDocument();
  });

  it.each(["/a/walk-agency/apps"])("sends the retired path %s to the agency's home screen with its tab bar", (path) => {
    at(path);
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
  });

  it("lands an agency's own address on its home screen", async () => {
    at("/a/other-agency");
    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("href", "/a/other-agency/home");
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
  });

  it("opens Start on the agency's do-something route", () => {
    at("/a/walk-agency/do-something");
    expect(screen.getByRole("heading", { name: "Start" })).toBeInTheDocument();
  });

  it("sends an unknown path to the agencies page when no agency is open", () => {
    forgetOpenAgency();
    at("/nowhere");
    expect(screen.getByRole("heading", { name: "Your agencies" })).toBeInTheDocument();
  });

  it("sends the old inbox path to the home screen, which is the inbox", () => {
    at("/inbox");
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
  });

  it("keeps the query string when the old inbox paths go home", () => {
    const seen: string[] = [];
    render(
      <MemoryRouter initialEntries={["/a/walk-agency/inbox?from=push"]}>
        <App />
        <Where seen={seen} />
      </MemoryRouter>,
    );
    expect(seen.at(-1)).toBe("/a/walk-agency/home?from=push");
  });

  it("keeps the query string when the agency-less inbox path goes home", () => {
    const seen: string[] = [];
    render(
      <MemoryRouter initialEntries={["/inbox?from=push"]}>
        <App />
        <Where seen={seen} />
      </MemoryRouter>,
    );
    expect(seen.at(-1)).toBe("/a/walk-agency/home?from=push");
  });

  it("opens straight onto a tab route", () => {
    at("/home");
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
  });

  it("sends the old agency inbox path to the agency's home screen", () => {
    at("/a/walk-agency/inbox");
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
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
