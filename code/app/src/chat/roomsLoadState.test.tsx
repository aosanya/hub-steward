import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { ChatPage } from "../pages/chat/ChatPage";
import type { ChatClient } from "./api";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const clientOf = (listRooms: ChatClient["listRooms"]): ChatClient => ({ listRooms }) as ChatClient;

const show = (client: ChatClient) =>
  render(
    <MemoryRouter>
      <ChatPage client={client} />
    </MemoryRouter>,
  );

describe("Chat load states", () => {
  it("says Loading Chat in place of a blank page while the rooms are read", async () => {
    show(clientOf(() => new Promise(() => undefined)));
    expect(screen.getByRole("status")).toHaveTextContent("Loading Chat");
    expect(screen.queryByText("No rooms yet.")).not.toBeInTheDocument();
  });

  it("offers Try again when the rooms fail and reads them again", async () => {
    const listRooms = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue([{ id: "s1", name: "Siaya farmers", threadId: "t1", threadName: "Farmers", unread: 0 }]);
    show(clientOf(listRooms));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chat could not be loaded.");
    expect(screen.queryByText("No rooms yet.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Siaya farmers")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(listRooms).toHaveBeenCalledTimes(2);
  });

  it("says Loading no more once the rooms answer", async () => {
    show(clientOf(async () => []));
    expect(await screen.findByText("No rooms yet.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
