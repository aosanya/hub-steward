import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { answerTools, renderPage } from "../work/renderPage";
import { ActivityView } from "./ActivityView";

vi.mock("../../wakala/mcp", async (importOriginal) => ({ ...(await importOriginal<object>()), callTool: vi.fn() }));

const roles = {
  items: [
    { id: "r1", name: "Hub Steward", status: "enabled" },
    { id: "r2", name: "Dispatcher", status: "disabled" },
  ],
};

const cards = () => Array.from(document.querySelectorAll<HTMLElement>(".card"));

const titles = () => cards().map((card) => card.querySelector(".card-toggle")?.textContent);

const opened = async (name: string) => {
  await userEvent.click(await screen.findByRole("button", { name }));
  return cards().find((card) => card.querySelector(".card-toggle")?.textContent === name) as HTMLElement;
};

describe("the activity page", () => {
  it("is titled Activity and lists each AI role as a card with its state", async () => {
    answerTools({ ai_list_roles: () => roles });
    renderPage("/h/h1/activity", <ActivityView />);
    expect(screen.getByRole("heading", { name: "Activity", level: 1 })).toBeInTheDocument();
    const dispatcher = await opened("Dispatcher");
    expect(cards()).toHaveLength(2);
    expect(dispatcher).toHaveTextContent("Switched off");
    expect(await opened("Hub Steward")).toHaveTextContent("Switched on");
  });

  it("shows a dash where the last action and its time are not known", async () => {
    answerTools({ ai_list_roles: () => roles });
    renderPage("/h/h1/activity", <ActivityView />);
    const card = await opened("Dispatcher");
    expect(within(card).getByText("Last action").nextElementSibling).toHaveTextContent("—");
    expect(within(card).getByText("Time").nextElementSibling).toHaveTextContent("—");
  });

  it("opens the agent's limits from the card's Open link", async () => {
    answerTools({ ai_list_roles: () => roles });
    renderPage("/h/h1/activity", <ActivityView />);
    await screen.findByRole("button", { name: "Dispatcher" });
    expect(screen.getAllByRole("link", { name: "Open" }).map((l) => l.getAttribute("href"))).toEqual(["/h/h1/agent-edit/r2/limits", "/h/h1/agent-edit/r1/limits"]);
  });

  it("lists the AI roles by name", async () => {
    answerTools({ ai_list_roles: () => roles });
    renderPage("/h/h1/activity", <ActivityView />);
    await screen.findByRole("button", { name: "Dispatcher" });
    expect(titles()).toEqual(["Dispatcher", "Hub Steward"]);
  });

  it("searches the AI roles by name", async () => {
    answerTools({ ai_list_roles: () => roles });
    renderPage("/h/h1/activity", <ActivityView />);
    await screen.findByRole("button", { name: "Dispatcher" });
    await userEvent.type(screen.getByPlaceholderText("Search activity"), "steward");
    expect(titles()).toEqual(["Hub Steward"]);
  });

  it("says nothing is here when the hub has no AI role", async () => {
    answerTools({ ai_list_roles: () => ({ items: [] }) });
    renderPage("/h/h1/activity", <ActivityView />);
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
    expect(cards()).toHaveLength(0);
  });

  it("draws the designed error state with a Try again button when the AI roles fail to load, then loads again", async () => {
    let up = false;
    const calls = answerTools({ ai_list_roles: () => (up ? roles : new Error("tool not mounted")) });
    renderPage("/h/h1/activity", <ActivityView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The page could not be loaded.");
    expect(screen.queryByRole("button", { name: "Dispatcher" })).not.toBeInTheDocument();
    up = true;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Dispatcher" })).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });
});
