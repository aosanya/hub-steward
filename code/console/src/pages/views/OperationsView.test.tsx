import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hiddenPages } from "../../data/menu";
import { answerTools, renderPage, type Tools } from "../work/renderPage";
import { OperationsView } from "./OperationsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const lab: Tools = {
  digitaltwin_node_list: () => ({
    items: [
      { id: "n1", name: "Lab router", kind: "Gateway", status: "online" },
      { id: "n2", name: "Lab switch", kind: "Switch", status: "fault" },
      { id: "n3", name: "Lab access point", kind: "Access point", status: "online" },
    ],
  }),
  digitaltwin_observation_latest: () => ({ observed_at: "2026-10-27T09:10:00Z" }),
  ai_list_roles: () => ({ items: [{ id: "r1", name: "Hub Steward", status: "enabled" }] }),
  comm_chat_thread_list: () => ({ items: [{ id: "t1", label: "Network alerts" }] }),
  comm_chat_message_list: () => ({ items: [{ id: "m1", body: "Lab switch is offline\nmore", created_at: "2026-10-27T09:11:00Z" }] }),
};

const calm: Tools = {
  ...lab,
  digitaltwin_node_list: () => ({
    items: [
      { id: "n1", name: "Lab router", kind: "Gateway", status: "online" },
      { id: "n2", name: "Lab switch", kind: "Switch", status: "online" },
      { id: "n3", name: "Lab access point", kind: "Access point", status: "online" },
    ],
  }),
  comm_chat_message_list: () => ({ items: [] }),
};

describe("the operations page", () => {
  it("draws the Agents tile quietly when some agent is switched off", async () => {
    answerTools({ ...calm, ai_list_roles: () => ({ items: [{ id: "r1", name: "A", status: "enabled" }, { id: "r2", name: "B", status: "disabled" }] }) });
    renderPage("/h/h1/operations", <OperationsView />);
    const agents = await screen.findByRole("link", { name: /Agents/ });
    expect(agents).toHaveTextContent("1 of 2 available");
    expect(agents).toHaveClass("tile", "mute");
  });

  it("asks for the open alerts of the hub's manager room and not for any when the hub has no room", async () => {
    const withRoom = answerTools(lab);
    renderPage("/h/h1/operations", <OperationsView />);
    await screen.findByRole("heading", { name: "Needs attention" });
    expect(withRoom.find((c) => c.tool === "comm_chat_thread_list")?.args).toEqual({ structure_id: "room1" });
  });

  it("draws the designed error state with a Try again button when the devices fail to load, then loads again", async () => {
    let up = false;
    const calls = answerTools({
      ...calm,
      digitaltwin_node_list: () => (up ? calm.digitaltwin_node_list({}) : new Error("tool not mounted")),
    });
    renderPage("/h/h1/operations", <OperationsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
    expect(screen.queryByRole("heading", { name: "Needs attention" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operations" })).toBeInTheDocument();
    up = true;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(calls.filter((c) => c.tool === "digitaltwin_node_list")).toHaveLength(2);
  });

  it("draws the same error state when the agents or the alerts fail to load", async () => {
    answerTools({ ...calm, ai_list_roles: () => new Error("down") });
    renderPage("/h/h1/operations", <OperationsView />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("draws the Agents and Alerts tiles and no Network tile, and links to the Network page nowhere, while that page is hidden", async () => {
    answerTools(lab);
    const { container } = renderPage("/h/h1/operations", <OperationsView />);
    expect(screen.getByRole("heading", { name: "Operations" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Agents/ })).toHaveAttribute("href", "/h/h1/activity");
    expect(screen.getByRole("link", { name: /Alerts/ })).toHaveAttribute("href", "/h/h1/alerts");
    expect(screen.queryByRole("link", { name: /Network/ })).not.toBeInTheDocument();
    expect(screen.queryByText("1 device in fault")).not.toBeInTheDocument();
    expect(container.querySelectorAll('a[href$="/network"]')).toHaveLength(0);
  });

  it("still lists a faulty device under Needs attention while the Network page is hidden, with no Open link to it, and keeps the Open link of the alert", async () => {
    answerTools(lab);
    renderPage("/h/h1/operations", <OperationsView />);
    expect(await screen.findByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Lab switch is in fault");
    expect(within(rows[0]).queryByRole("link")).not.toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/alerts");
  });

  it("draws no Open column when the only row under Needs attention is a faulty device and the Network page is hidden", async () => {
    answerTools({ ...lab, comm_chat_message_list: () => ({ items: [] }) });
    renderPage("/h/h1/operations", <OperationsView />);
    expect(await screen.findByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Area", "What", "State"]);
    expect(within(table).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("the operations page with the Network page shown", () => {
  let held: string[] = [];

  beforeEach(() => {
    held = hiddenPages.splice(0);
  });

  afterEach(() => {
    hiddenPages.push(...held);
  });

  it("is titled Operations and draws the Network, Agents and Alerts tiles, the faulty network in the warning colour", async () => {
    answerTools(lab);
    renderPage("/h/h1/operations", <OperationsView />);
    expect(screen.getByRole("heading", { name: "Operations" })).toBeInTheDocument();
    const network = await screen.findByRole("link", { name: /Network/ });
    expect(network).toHaveTextContent("1 device in fault");
    expect(network).toHaveClass("tile", "bad");
    expect(network).toHaveAttribute("href", "/h/h1/network");
    const agents = screen.getByRole("link", { name: /Agents/ });
    expect(agents).toHaveTextContent("1 of 1 available");
    expect(agents).toHaveAttribute("href", "/h/h1/activity");
    const alerts = screen.getByRole("link", { name: /Alerts/ });
    expect(alerts).toHaveTextContent("1 open");
    expect(alerts).toHaveClass("tile", "bad");
    expect(alerts).toHaveAttribute("href", "/h/h1/alerts");
  });

  it("lists the faulty device and the open alert under Needs attention, each with an Open link", async () => {
    answerTools(lab);
    renderPage("/h/h1/operations", <OperationsView />);
    expect(await screen.findByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Area", "What", "State", ""]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Network");
    expect(rows[0]).toHaveTextContent("Lab switch is in fault");
    expect(rows[0]).toHaveTextContent("Fault");
    expect(within(rows[0]).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/network");
    expect(rows[1]).toHaveTextContent("Alert");
    expect(rows[1]).toHaveTextContent("Lab switch is offline");
    expect(rows[1]).toHaveTextContent("Open");
    expect(within(rows[1]).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/alerts");
  });

  it("draws every tile calm when all devices are up, no alert is open and every agent is on", async () => {
    answerTools(calm);
    renderPage("/h/h1/operations", <OperationsView />);
    const network = await screen.findByRole("link", { name: /Network/ });
    expect(network).toHaveTextContent("All 3 devices up");
    expect(network).not.toHaveClass("bad");
    expect(screen.getByRole("link", { name: /Alerts/ })).toHaveTextContent("No alerts open");
    expect(screen.getByRole("link", { name: /Agents/ })).not.toHaveClass("mute");
    expect(screen.getByText("Nothing needs attention.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("counts several faulty devices", async () => {
    answerTools({
      ...calm,
      digitaltwin_node_list: () => ({
        items: [
          { id: "n1", name: "A", kind: "Switch", status: "fault" },
          { id: "n2", name: "B", kind: "Switch", status: "offline" },
          { id: "n3", name: "C", kind: "Switch", status: "online" },
        ],
      }),
    });
    renderPage("/h/h1/operations", <OperationsView />);
    expect(await screen.findByRole("link", { name: /Network/ })).toHaveTextContent("2 devices in fault");
  });

  it("says there are no devices yet when the hub has none", async () => {
    answerTools({ ...calm, digitaltwin_node_list: () => ({ items: [] }) });
    renderPage("/h/h1/operations", <OperationsView />);
    const network = await screen.findByRole("link", { name: /Network/ });
    expect(network).toHaveTextContent("No devices yet");
    expect(network).toHaveClass("mute");
  });
});
