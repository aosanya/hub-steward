import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskQuestion } from "./AskQuestion";
import type { QuestionsClient } from "./types";

afterEach(cleanup);

const roles = [
  { id: "r1", code: "product-owner", name: "Product owner" },
  { id: "r2", code: "", name: "Council" },
];

const clientOf = (over: Partial<QuestionsClient> = {}): QuestionsClient => ({
  forIssue: vi.fn(async () => []),
  read: vi.fn(),
  list: vi.fn(),
  answer: vi.fn(),
  standing: async () => ({ holds: () => true, nameOf: (role: string) => role, canAsk: true }),
  roles: vi.fn(async () => roles),
  ask: vi.fn(async () => "Q-20"),
  ...over,
});

const open = (client: QuestionsClient, extra: { onAsked?: () => void; onClose?: () => void } = {}) =>
  render(<AskQuestion issueId="issue-1" tags={["hub-steward"]} client={client} onAsked={extra.onAsked ?? vi.fn()} onClose={extra.onClose ?? vi.fn()} />);

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("the new-question form", () => {
  it("lists the agency's roles by name and keeps Ask off until the question and the role are filled", async () => {
    open(clientOf());
    expect(await screen.findByRole("radio", { name: "Product owner" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Council" })).toBeInTheDocument();
    const ask = screen.getByRole("button", { name: "Ask" });
    expect(ask).toBeDisabled();
    type("Question", "Which language should it open in?");
    expect(ask).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Council" }));
    expect(ask).toBeEnabled();
  });

  it("says a role must be chosen once a question is typed and none is chosen", async () => {
    open(clientOf());
    await screen.findByRole("radio", { name: "Council" });
    expect(screen.queryByText("Choose who this is for.")).toBeNull();
    type("Question", "Which language?");
    expect(screen.getByText("Choose who this is for.")).toBeInTheDocument();
  });

  it("sends the role's code, or its id when it has none, with the priority, the why, the issue and its tags", async () => {
    const client = clientOf();
    const onAsked = vi.fn();
    open(client, { onAsked });
    type("Question", "Which language?");
    type("Why it is asked", "The first import fixes the default.");
    fireEvent.click(screen.getByRole("button", { name: "P1" }));
    fireEvent.click(await screen.findByRole("radio", { name: "Product owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(client.ask).toHaveBeenCalled());
    expect(client.ask).toHaveBeenCalledWith({ title: "Which language?", body: "The first import fixes the default.", priority: "P1", targetRole: "product-owner", options: [], tags: ["hub-steward"], issueId: "issue-1" });
    await waitFor(() => expect(onAsked).toHaveBeenCalled());
    cleanup();
    open(client);
    type("Question", "Who signs?");
    fireEvent.click(await screen.findByRole("radio", { name: "Council" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(client.ask).toHaveBeenCalledTimes(2));
    expect(vi.mocked(client.ask!).mock.calls[1][0]).toMatchObject({ targetRole: "r2", priority: "P2" });
  });

  it("offers answers, at most five, with one Recommended that needs its reason", async () => {
    const client = clientOf();
    open(client);
    type("Question", "Which language?");
    fireEvent.click(await screen.findByRole("radio", { name: "Council" }));
    const first = screen.getAllByPlaceholderText("An answer");
    fireEvent.change(first[0], { target: { value: "English first" } });
    fireEvent.change(first[1], { target: { value: "Swahili first" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Recommend" })[0]);
    const ask = screen.getByRole("button", { name: "Ask" });
    expect(ask).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Why this one"), { target: { value: "The template is in English." } });
    expect(ask).toBeEnabled();
    fireEvent.click(screen.getAllByRole("button", { name: "Recommend" })[1]);
    expect(screen.getAllByRole("button", { pressed: true }).filter((one) => one.textContent === "Recommend")).toHaveLength(1);
    fireEvent.click(ask);
    await waitFor(() => expect(client.ask).toHaveBeenCalled());
    expect(vi.mocked(client.ask!).mock.calls[0][0].options).toEqual([
      { text: "English first", recommended: false, reason: "" },
      { text: "Swahili first", recommended: true, reason: "The template is in English." },
    ]);
  });

  it("stops adding answers at five and leaves out blank ones", async () => {
    const client = clientOf();
    open(client);
    for (let more = 0; more < 6; more += 1) {
      const add = screen.queryByRole("button", { name: "Add an answer" });
      if (add) fireEvent.click(add);
    }
    expect(screen.getAllByPlaceholderText("An answer")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Add an answer" })).toBeNull();
    type("Question", "Which?");
    fireEvent.click(await screen.findByRole("radio", { name: "Council" }));
    fireEvent.change(screen.getAllByPlaceholderText("An answer")[0], { target: { value: "Only one" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(client.ask).toHaveBeenCalled());
    expect(vi.mocked(client.ask!).mock.calls[0][0].options).toEqual([{ text: "Only one", recommended: false, reason: "" }]);
  });

  it("says the question was not saved and stays open when the ask fails", async () => {
    const onClose = vi.fn();
    const onAsked = vi.fn();
    open(clientOf({ ask: vi.fn(async () => Promise.reject(new Error("down"))) }), { onClose, onAsked });
    type("Question", "Which?");
    fireEvent.click(await screen.findByRole("radio", { name: "Council" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("The question was not saved. Try again.")).toBeInTheDocument();
    expect(onAsked).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from Cancel without asking", async () => {
    const client = clientOf();
    const onClose = vi.fn();
    open(client, { onClose });
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(client.ask).not.toHaveBeenCalled();
  });

  it("says the roles could not be loaded when the list fails, and never asks", async () => {
    const client = clientOf({ roles: vi.fn(async () => Promise.reject(new Error("down"))) });
    open(client);
    expect(await screen.findByText("The roles could not be loaded.")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Ask" })).toBeDisabled();
  });
});
