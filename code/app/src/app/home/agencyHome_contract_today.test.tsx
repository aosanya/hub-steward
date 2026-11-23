import { vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { agencyId, everyFact, filesEntry, forgetLanded, landed, needsYouWords, rowTitles, rowsBelowStrip, settle, showHome, type Setup } from "./agencyHome_contract_adapters";

vi.mock("../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 3, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const todaysRows = ["People", "Places & Addresses", "Issues & Requests", "Services & Permits", "Assets & Works", "Decisions", "Staff & Departments", "Finance", "Tools", "Settings"];

const municipality: Setup = { ...everyFact, modules: ["taskmanager", "actor", "forms", "digitaltwin", "assetmanager", "council", "accounting", "git"] };

const settledHome = async (setup: Setup) => {
  const shown = showHome(setup);
  await waitFor(() => expect(rowTitles(shown.container)).toContain("Settings"));
  await waitFor(() => expect(rowTitles(shown.container)).toContain("Tools"));
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

  it("is the Needs-you strip, the fixed sections, then Tools, then Settings last, and no Start or Ongoing row", async () => {
    const { container } = await settledHome(setup);
    expect(rowTitles(container)).toEqual([needsYouWords(3), ...todaysRows]);
    expect(rowTitles(container)).not.toContain("Start");
    expect(rowTitles(container)).not.toContain("Ongoing");
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

  it.each(["Backlogs", "Files", "Tools", "People", "Settings"])("draws no %s row of today's Home behind the failure line", async (title) => {
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
    await waitFor(() => expect(rowTitles(container)).toContain("Tools"));
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
  it("draws every section its modules switch on, then Tools, then Settings last", async () => {
    const { container } = await settledHome(municipality);
    expect(rowTitles(container)).toEqual([needsYouWords(3), ...todaysRows]);
  });

  it.each([
    ["Tools", "/a/alego/home/tools"],
    ["Issues & Requests", "/a/alego/menu/issues"],
    ["Settings", "/a/alego/menu/settings"],
  ])("opens %s on the same screen as today", async (title, path) => {
    const user = userEvent.setup();
    await settledHome(municipality);
    await user.click(screen.getByRole("button", { name: new RegExp(title) }));
    expect(landed).toBe(path);
  });
});
