import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hiddenPages } from "../../data/menu";
import { answerTools, renderPage, type Tools } from "../work/renderPage";
import { AlertsView } from "./AlertsView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const raised = new Date(2026, 9, 24, 14, 2).toISOString();

const lab: Tools = {
  comm_chat_thread_list: () => ({ items: [{ id: "t1", label: "Chat" }, { id: "t2", label: "Network alerts" }] }),
  comm_chat_message_list: () => ({
    items: [
      { id: "m1", body: "Lab switch is offline\nNetwork fault: 4 terminals lost the network.", created_at: raised },
      { id: "m2", body: "Camera 3 offline", created_at: raised },
    ],
  }),
};

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("the alerts page", () => {
  it("is titled Alerts and lists each alert with its state and when it was raised", async () => {
    answerTools(lab);
    renderPage("/h/h1/alerts", <AlertsView />);
    expect(screen.getByRole("heading", { name: "Alerts" })).toBeInTheDocument();
    await screen.findByRole("table");
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Alert", "State", "Time", ""]);
    const rows = bodyRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Lab switch is offline");
    expect(rows[0]).toHaveTextContent("Open");
    expect(rows[0]).toHaveTextContent("Oct 24, 14:02");
    expect(rows[1]).toHaveTextContent("Camera 3 offline");
  });

  it("asks the hub's manager room for the alerts", async () => {
    const calls = answerTools(lab);
    renderPage("/h/h1/alerts", <AlertsView />, { manager_room_id: "room9" });
    await screen.findByRole("table");
    expect(calls.map((c) => [c.tool, c.args])).toEqual([
      ["comm_chat_thread_list", { structure_id: "room9" }],
      ["comm_chat_message_list", { structure_id: "room9", thread_id: "t2" }],
    ]);
  });

  it("says nothing is here when the hub has no manager room", async () => {
    const calls = answerTools(lab);
    renderPage("/h/h1/alerts", <AlertsView />, { manager_room_id: undefined });
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("opens an alert from its name and from its Open link", async () => {
    answerTools(lab);
    renderPage("/h/h1/alerts", <AlertsView />);
    await screen.findByRole("table");
    const row = bodyRows()[0];
    expect(within(row).getByRole("link", { name: "Lab switch is offline" })).toHaveAttribute("href", "/h/h1/alerts?alert=m1");
    expect(within(row).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/alerts?alert=m1");
  });

  it("searches the alerts by their words", async () => {
    answerTools(lab);
    renderPage("/h/h1/alerts", <AlertsView />);
    await screen.findByRole("table");
    await userEvent.type(screen.getByPlaceholderText("Search alerts"), "camera");
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent("Camera 3 offline");
  });

  it("offers the All states, Open, Acknowledged and Closed filters and shows only the open alerts for Open", async () => {
    answerTools(lab);
    renderPage("/h/h1/alerts", <AlertsView />);
    await screen.findByRole("table");
    const states = screen.getByRole("combobox", { name: "All states" });
    expect(within(states).getAllByRole("option").map((o) => o.textContent)).toEqual(["All states", "Open", "Acknowledged", "Closed"]);
    await userEvent.selectOptions(states, "open");
    expect(bodyRows()).toHaveLength(2);
    await userEvent.selectOptions(states, "closed");
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("draws the designed error state with a Try again button when the alerts fail to load", async () => {
    const calls = answerTools({ ...lab, comm_chat_thread_list: () => new Error("down") });
    renderPage("/h/h1/alerts", <AlertsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("alert");
    expect(calls.filter((c) => c.tool === "comm_chat_thread_list")).toHaveLength(2);
  });
});

describe("one alert on the alerts page", () => {
  it("is titled with the alert's first line and shows its state, when it was raised and the whole message", async () => {
    answerTools(lab);
    renderPage("/h/h1/alerts?alert=m1", <AlertsView />);
    expect(await screen.findByRole("heading", { name: "Lab switch is offline", level: 1 })).toBeInTheDocument();
    const facts = screen.getByText("Raised").closest("dl")!;
    expect(within(facts).getByText("Open")).toBeInTheDocument();
    expect(within(facts).getByText("Oct 24, 14:02")).toBeInTheDocument();
    expect(within(facts).getByText(/4 terminals lost the network/)).toBeInTheDocument();
  });

  it("offers no Open Network link while the Network page is held back", async () => {
    answerTools(lab);
    renderPage("/h/h1/alerts?alert=m1", <AlertsView />);
    await screen.findByRole("heading", { name: "Lab switch is offline", level: 1 });
    expect(screen.queryByRole("link", { name: "Open Network" })).not.toBeInTheDocument();
  });

  it("says nothing is here when the alert is not among the room's alerts", async () => {
    answerTools(lab);
    renderPage("/h/h1/alerts?alert=gone", <AlertsView />);
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("draws the designed error state when the alerts cannot be read", async () => {
    answerTools({ ...lab, comm_chat_message_list: () => new Error("down") });
    renderPage("/h/h1/alerts?alert=m1", <AlertsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
  });
});

describe("one alert on the alerts page with the Network page shown", () => {
  let held: string[] = [];

  beforeEach(() => {
    held = hiddenPages.splice(0);
  });

  afterEach(() => {
    hiddenPages.push(...held);
  });

  it("links to the Network page", async () => {
    answerTools(lab);
    renderPage("/h/h1/alerts?alert=m1", <AlertsView />);
    expect(await screen.findByRole("link", { name: "Open Network" })).toHaveAttribute("href", "/h/h1/network");
  });
});
