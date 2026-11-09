import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { forgetOpenAgency, openAgency } from "./agency/open";
import { doSomethingBar, homeBar } from "./tabs";
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
    expect(links).toHaveLength(homeBar.length);
    homeBar.forEach((tab, i) => expect(links[i]).toHaveTextContent(tab.label));
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).not.toHaveAttribute("aria-current");
  });

  it("switches page on navigation", async () => {
    at("/");
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Chat/ }));
    expect(screen.getByRole("heading", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chat/ })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("link", { name: /Inbox/ }));
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Do Something/ }));
    expect(await screen.findByRole("heading", { name: "Do Something" })).toBeInTheDocument();
  });

  it("swaps to the Do Something bar on Do Something, and Home swaps back", async () => {
    at("/a/walk-agency/do-something");
    expect(await screen.findByRole("link", { name: /Start/ })).toHaveAttribute("aria-current", "page");
    expect(barLabels()).toEqual(["Home", "Start", "Ongoing"]);
    await userEvent.click(screen.getByRole("link", { name: /Ongoing/ }));
    expect(screen.getByRole("link", { name: /Ongoing/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Start/ })).not.toHaveAttribute("aria-current");
    await userEvent.click(screen.getByRole("link", { name: /Home/ }));
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(barLabels()).toEqual(["Home", "Chat", "Do Something", "Inbox"]);
  });

  it("holds Home, Chat, Do Something and Inbox and keeps no Apps or Started tab", () => {
    expect(homeBar.map((tab) => tab.label)).toEqual(["Home", "Chat", "Do Something", "Inbox"]);
    expect(doSomethingBar.map((tab) => tab.label)).toEqual(["Home", "Start", "Ongoing", "Backlogs"]);
  });

  it("draws four labels in the home bar", () => {
    at("/");
    expect(barLabels()).toEqual(["Home", "Chat", "Do Something", "Inbox"]);
  });

  it("draws nothing in the home screen's body", () => {
    at("/a/walk-agency/home");
    expect(within(screen.getByRole("main")).queryAllByRole("button")).toEqual([]);
    expect(screen.getByRole("main")).toHaveTextContent("");
  });

  it("ends the agency's old started address on its home screen", async () => {
    at("/a/other-agency/started");
    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Started" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("href", "/a/other-agency/home");
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("aria-current", "page");
  });

  it("ends the agency-less /started on the open agency's home screen", async () => {
    at("/started");
    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("href", "/a/walk-agency/home");
  });

  it("has no page at the old apps tab route", () => {
    at("/a/walk-agency/apps");
    expect(screen.queryByRole("heading", { name: "Apps" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Apps/ })).not.toBeInTheDocument();
  });

  it.each(["/profile", "/language", "/sign-out", "/a/walk-agency/apps"])("sends the unbuilt or retired path %s to the agency's home screen with its tab bar", (path) => {
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
