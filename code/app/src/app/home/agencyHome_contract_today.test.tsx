import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { MenuRows } from "../menu/MenuRows";
import { HomeOptions } from "./HomeOptions";
import { NeedsYouStrip } from "./NeedsYouStrip";
import { agencyId, everyFact, filesEntry, forgetLanded, hubOf, homePathOf, landed, needsYouWords, rowTitles, rowsBelowStrip, settle, showHome, wiringOf, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 3, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const todaysRows = ["Start", "Ongoing", "Backlogs", "Files", "People", "Places & Addresses", "Issues & Requests", "Services & Permits", "Assets & Works", "Decisions", "Staff & Departments", "Finance", "Settings"];

const municipality: Setup = { ...everyFact, modules: ["taskmanager", "actor", "forms", "digitaltwin", "assetmanager", "council", "accounting", "git"] };

const todayDrawnOf = async (setup: Setup) => {
  hubOf(setup);
  const wiring = wiringOf(setup);
  const { container } = render(
    <MemoryRouter initialEntries={[homePathOf(agencyId)]}>
      <NeedsYouStrip />
      <HomeOptions {...wiring} />
      <MenuRows agency={wiring.agency} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(rowTitles(container)).toContain("Settings"));
  await waitFor(() => expect(rowTitles(container)).toContain("Files"));
  const drawn = container.innerHTML;
  cleanup();
  return drawn;
};

const settledHome = async (setup: Setup) => {
  const shown = showHome(setup);
  await waitFor(() => expect(rowTitles(shown.container)).toContain("Settings"));
  await waitFor(() => expect(rowTitles(shown.container)).toContain("Files"));
  return shown;
};

beforeEach(() => {
  openAgency(agencyId);
  forgetLanded();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("Home when the hub returns an empty list", () => {
  const setup: Setup = { ...everyFact, nodes: [] };

  it("is today's Home: the Needs-you strip, then Start, Ongoing, Backlogs, Files and the fixed sections", async () => {
    const { container } = await settledHome(setup);
    expect(rowTitles(container)).toEqual([needsYouWords(3), ...todaysRows]);
  });

  it("is drawn exactly as the Needs-you strip, HomeOptions and MenuRows draw it side by side", async () => {
    const expected = await todayDrawnOf(setup);
    const { container } = await settledHome(setup);
    expect(container.innerHTML).toBe(expected);
  });
});

describe("Home when the Home call fails", () => {
  const down: Setup = { ...everyFact, nodes: [], down: { home: true } };

  it("shows a failure line with Try again, and not the fixed Home", async () => {
    const { container } = showHome(down);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    await settle();
    expect(rowsBelowStrip(container)).toEqual([]);
  });

  it.each(["Start", "Ongoing", "Backlogs", "Files", "People", "Settings"])("draws no %s row of today's Home behind the failure line", async (title) => {
    const { container } = showHome(down);
    await screen.findByRole("alert");
    await settle();
    expect(rowTitles(container)).not.toContain(title);
  });

  it("reads again on Try again and draws today's Home when the hub now returns an empty list", async () => {
    const user = userEvent.setup();
    const outage = { home: true };
    const { container } = showHome({ ...everyFact, nodes: [], down: outage });
    const retry = await screen.findByRole("button", { name: "Try again" });
    outage.home = false;
    await user.click(retry);
    await waitFor(() => expect(rowTitles(container)).toContain("Settings"));
    await waitFor(() => expect(rowTitles(container)).toContain("Files"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reads again on Try again and draws the declared Home when the hub now returns one", async () => {
    const user = userEvent.setup();
    const outage = { home: true };
    const { container } = showHome({ ...everyFact, nodes: [filesEntry("files", "Our files")], down: outage });
    const retry = await screen.findByRole("button", { name: "Try again" });
    outage.home = false;
    await user.click(retry);
    await waitFor(() => expect(rowsBelowStrip(container)).toEqual(["Our files"]));
  });
});

describe("a municipality-style agency that declares nothing", () => {
  it("is drawn exactly as today, with Files and every section its modules switch on", async () => {
    const expected = await todayDrawnOf(municipality);
    const { container } = await settledHome(municipality);
    expect(container.innerHTML).toBe(expected);
    expect(rowTitles(container)).toEqual([needsYouWords(3), ...todaysRows]);
  });

  it.each([
    ["Start", "/a/alego/do-something"],
    ["Issues & Requests", "/a/alego/menu/issues"],
  ])("opens %s on the same screen as today", async (title, path) => {
    const user = userEvent.setup();
    await settledHome(municipality);
    await user.click(screen.getByRole("button", { name: new RegExp(title) }));
    expect(landed).toBe(path);
  });
});
