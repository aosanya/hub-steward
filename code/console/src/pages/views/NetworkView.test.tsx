import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { answerTools, renderPage, type Tools } from "../work/renderPage";
import { NetworkView } from "./NetworkView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const seen = new Date(2026, 9, 24, 14, 2).toISOString();

const lab: Tools = {
  digitaltwin_node_list: () => ({
    items: [
      { id: "n1", name: "Lab router", kind: "Gateway", status: "online" },
      { id: "n2", name: "Lab switch", kind: "Switch", status: "fault" },
      { id: "n3", name: "Lab access point", kind: "Access point", status: "online" },
    ],
  }),
  digitaltwin_observation_latest: (args) => (args.node_id === "n2" ? new Error("never seen") : { observed_at: seen }),
  digitaltwin_link_list: (args) =>
    args.node_id === "n2"
      ? { items: [{ from_node_id: "n2", to_node_id: "t1" }, { from_node_id: "n2", to_node_id: "t2" }] }
      : { items: [] },
  digitaltwin_node_read: (args) => ({ id: args.node_id, name: `Terminal ${String(args.node_id).slice(1)}`, kind: "Wired", status: "offline" }),
};

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));

const titles = () => cards().map((card) => card.querySelector(".card-toggle")?.textContent);

const opened = async (name: string) => {
  await userEvent.click(await screen.findByRole("button", { name }));
  return cards().find((card) => card.querySelector(".card-toggle")?.textContent === name) as HTMLElement;
};

describe("the network page", () => {
  it("is titled Network and lists each device as a card with its type, its state and when it was last seen", async () => {
    answerTools(lab);
    renderPage("/h/h1/network", <NetworkView />);
    expect(screen.getByRole("heading", { name: "Network", level: 1 })).toBeInTheDocument();
    const router = await opened("Lab router");
    expect(cards()).toHaveLength(3);
    expect(router).toHaveTextContent("Gateway");
    expect(router).toHaveTextContent("Online");
    expect(router).toHaveTextContent("Oct 24, 14:02");
    const switchCard = await opened("Lab switch");
    expect(switchCard).toHaveTextContent("Fault");
    expect(switchCard).toHaveTextContent("—");
  });

  it("lists the devices by name", async () => {
    answerTools(lab);
    renderPage("/h/h1/network", <NetworkView />);
    await screen.findByRole("button", { name: "Lab router" });
    expect(titles()).toEqual(["Lab access point", "Lab router", "Lab switch"]);
  });

  it("opens a device from its Open link", async () => {
    answerTools(lab);
    renderPage("/h/h1/network", <NetworkView />);
    await screen.findByRole("button", { name: "Lab switch" });
    const card = cards()[2];
    expect(within(card).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/h1/network?device=n2");
  });

  it("searches the devices by name", async () => {
    answerTools(lab);
    renderPage("/h/h1/network", <NetworkView />);
    await screen.findByRole("button", { name: "Lab router" });
    await userEvent.type(screen.getByPlaceholderText("Search network"), "access");
    expect(titles()).toEqual(["Lab access point"]);
  });

  it("filters the devices by state", async () => {
    answerTools(lab);
    renderPage("/h/h1/network", <NetworkView />);
    await screen.findByRole("button", { name: "Lab router" });
    const states = screen.getByRole("combobox", { name: "All states" });
    await userEvent.selectOptions(states, "fault");
    expect(titles()).toEqual(["Lab switch"]);
    await userEvent.selectOptions(states, "online");
    expect(cards()).toHaveLength(2);
    await userEvent.selectOptions(states, "all");
    expect(cards()).toHaveLength(3);
  });

  it("says nothing is here when no device matches", async () => {
    answerTools(lab);
    renderPage("/h/h1/network", <NetworkView />);
    await screen.findByRole("button", { name: "Lab router" });
    await userEvent.type(screen.getByPlaceholderText("Search network"), "zzz");
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    expect(cards()).toHaveLength(0);
  });

  it("draws the designed error state with a Try again button when the devices fail to load", async () => {
    const calls = answerTools({ ...lab, digitaltwin_node_list: () => new Error("tool not mounted") });
    renderPage("/h/h1/network", <NetworkView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
    expect(screen.queryByPlaceholderText("Search network")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("alert");
    expect(calls.filter((c) => c.tool === "digitaltwin_node_list")).toHaveLength(2);
  });
});

describe("one device on the network page", () => {
  it("is titled with the device and shows its type, state and last seen beside an Open Alerts link", async () => {
    answerTools(lab);
    renderPage("/h/h1/network?device=n2", <NetworkView />);
    expect(await screen.findByRole("heading", { name: "Lab switch", level: 1 })).toBeInTheDocument();
    const facts = screen.getByText("Last seen").closest("dl")!;
    expect(within(facts).getByText("Switch")).toBeInTheDocument();
    expect(within(facts).getByText("Fault")).toBeInTheDocument();
    expect(within(facts).getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Alerts" })).toHaveAttribute("href", "/h/h1/alerts");
  });

  it("lists the clients behind the device with no network", async () => {
    answerTools(lab);
    renderPage("/h/h1/network?device=n2", <NetworkView />);
    expect(await screen.findByRole("heading", { name: "Clients behind it" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Client", "Type", "State"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Terminal 1");
    expect(rows[0]).toHaveTextContent("Wired");
    expect(rows[0]).toHaveTextContent("No network");
  });

  it("says nothing is here when the device is not on the network", async () => {
    answerTools(lab);
    renderPage("/h/h1/network?device=gone", <NetworkView />);
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("draws the designed error state when the clients cannot be read", async () => {
    answerTools({ ...lab, digitaltwin_link_list: () => new Error("down") });
    renderPage("/h/h1/network?device=n2", <NetworkView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
  });
});
