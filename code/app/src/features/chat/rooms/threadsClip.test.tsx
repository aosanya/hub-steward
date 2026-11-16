import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RoomThreadsPage } from "./RoomThreadsPage";
import type { RoomsClient } from "./api";
import { routes } from "../../../app/routes";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

const client = {
  subject: async () => "me",
  listThreads: async () => [{ id: "t1", label: "General", audience: "group", requestedBy: "", declined: false, unread: 0, lastMessageAt: "", preview: "" }],
  listMessages: async () => [],
  startThread: async () => "t2",
} as unknown as RoomsClient;

describe("Threads list rows", () => {
  it("clip the second line to one line, as the Chat list does", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/a/farmers/chat/r1/threads"]}>
        <Routes>
          <Route path={routes.roomThreads.pattern} element={<RoomThreadsPage client={client} />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("General");
    expect(container.querySelector("button.row.room")).not.toBeNull();
  });
});

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const withPreview = {
  ...client,
  listThreads: async () => [{ id: "t1", label: "General", audience: "group", requestedBy: "", declined: false, unread: 0, lastMessageAt: "", preview: "Seed prices are up" }],
} as unknown as RoomsClient;

const empty = { ...client, listThreads: async () => [] } as unknown as RoomsClient;

const openThreads = (threadsClient: RoomsClient) =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/chat/r1/threads"]}>
      <Routes>
        <Route path={routes.roomThreads.pattern} element={<RoomThreadsPage client={threadsClient} />} />
      </Routes>
    </MemoryRouter>,
  );

const tree = () => document.querySelector(".wf .wf-panes .wf-tree") as HTMLElement | null;

describe("Threads list in the Folders frame", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("sits in the Folders frame on a wide screen, the rows and the start button in the list pane", async () => {
    setWide(true);
    openThreads(withPreview);
    await screen.findByText("General");

    expect(tree()).not.toBeNull();
    expect(document.querySelector(".wf .wf-panes .wf-main")).not.toBeNull();
    expect(within(tree() as HTMLElement).getByText("Seed prices are up")).toBeInTheDocument();
    expect(within(tree() as HTMLElement).getByRole("button", { name: "Start a thread" })).toBeInTheDocument();
  });

  it("keeps the clipped preview row on a wide screen", async () => {
    setWide(true);
    openThreads(withPreview);
    await screen.findByText("General");

    expect(within(tree() as HTMLElement).getByRole("button", { name: /General/ })).toHaveClass("row", "room");
  });

  it("holds the empty card with its start button in the list pane on a wide screen", async () => {
    setWide(true);
    openThreads(empty);
    await screen.findByText("No messages yet.");

    expect(within(tree() as HTMLElement).getByRole("button", { name: "Start a thread" })).toBeInTheDocument();
  });

  it("stays the plain list on a phone, with no frame", async () => {
    setWide(false);
    openThreads(withPreview);
    await screen.findByText("General");

    expect(document.querySelector(".wf")).toBeNull();
    expect(screen.getByRole("button", { name: "Start a thread" })).toBeInTheDocument();
  });

  it("shows the empty card with its start button on a phone, with no frame", async () => {
    setWide(false);
    openThreads(empty);
    await screen.findByText("No messages yet.");

    expect(document.querySelector(".wf")).toBeNull();
    expect(screen.getByRole("button", { name: "Start a thread" })).toBeInTheDocument();
  });
});
