import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { RoomThread, RoomsClient } from "./api";
import { RoomThreadPage } from "./RoomThreadPage";
import { routes } from "../../../app/routes";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";

beforeEach(() => openAgency("council"));

afterEach(() => forgetOpenAgency());

const thread = (over: Partial<RoomThread>): RoomThread => ({
  id: "t1",
  label: "General",
  audience: "group",
  requestedBy: "",
  askerName: "",
  questionRoom: false,
  takesQuestions: false,
  leader: false,
  declined: false,
  unread: 0,
  lastMessageAt: "",
  preview: "",
  ...over,
});

const clientWith = (threads: RoomThread[]): RoomsClient => ({
  subject: vi.fn().mockResolvedValue("u1"),
  roomName: vi.fn().mockResolvedValue("Services Desk"),
  listThreads: vi.fn().mockResolvedValue(threads),
  listMessages: vi.fn().mockResolvedValue([]),
  post: vi.fn().mockResolvedValue(undefined),
  startThread: vi.fn().mockResolvedValue("t9"),
  getOrder: vi.fn(),
  answerRevision: vi.fn(),
  getAsk: vi.fn().mockResolvedValue(null),
  setQuestionRoom: vi.fn().mockResolvedValue(undefined),
});

const show = (client: RoomsClient) =>
  render(
    <MemoryRouter initialEntries={["/a/council/chat/r1/t1"]}>
      <Routes>
        <Route path={routes.roomThread.pattern} element={<RoomThreadPage client={client} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("a question room", () => {
  it("gives a member Ask a question instead of the open composer", async () => {
    show(clientWith([thread({ questionRoom: true })]));
    expect(await screen.findByRole("button", { name: "Ask a question" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Write to/)).toBeNull();
  });

  it("starts the member's own thread with the question's subject", async () => {
    const client = clientWith([thread({ questionRoom: true })]);
    show(client);
    await userEvent.click(await screen.findByRole("button", { name: "Ask a question" }));
    await userEvent.type(screen.getByLabelText("What is your question about?"), "Permit office hours");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(client.startThread).toHaveBeenCalledWith("r1", "Permit office hours");
  });

  it("keeps the open composer in an ordinary room", async () => {
    show(clientWith([thread({})]));
    expect(await screen.findByPlaceholderText(/Write to/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask a question" })).toBeNull();
  });

  it("lists a question for the clerk's office by the asker's name", async () => {
    show(clientWith([thread({}), thread({ id: "t2", label: "Permit office hours", audience: "leads", requestedBy: "u7", askerName: "Sipos Hanna" })]));
    expect(await screen.findByText(/Asked by Sipos Hanna/)).toBeInTheDocument();
  });

  it("says Unnamed person when the asker has no name, never the id", async () => {
    show(clientWith([thread({}), thread({ id: "t2", label: "Opening hours", audience: "leads", requestedBy: "u7", askerName: "" })]));
    expect(await screen.findByText(/Asked by Unnamed person/)).toBeInTheDocument();
    expect(screen.queryByText(/u7/)).toBeNull();
  });

  it("tells the member who asked that only they and the room's leaders read the question", async () => {
    show(clientWith([thread({ id: "t0" }), thread({ id: "t1", label: "Permit office hours", audience: "leads", requestedBy: "u1", questionRoom: true })]));
    expect(await screen.findByText("Only you and the room's leaders read this question.")).toBeInTheDocument();
    expect(screen.queryByText(/members cannot see this yet/)).toBeNull();
  });

  it("keeps the old note on a leaders-only request in a room that takes no questions", async () => {
    show(clientWith([thread({ id: "t0" }), thread({ id: "t1", label: "Ask for a seat", audience: "leads", requestedBy: "u1" })]));
    expect(await screen.findByText("Leaders only · members cannot see this yet")).toBeInTheDocument();
  });
});

describe("the switch for a room that takes questions", () => {
  it("shows a leader the switch in words, off when the room takes no questions", async () => {
    show(clientWith([thread({ leader: true })]));
    expect(await screen.findByText("This room takes questions")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "This room takes questions" })).not.toBeChecked();
  });

  it("shows the switch on when the room takes questions", async () => {
    show(clientWith([thread({ leader: true, takesQuestions: true })]));
    expect(await screen.findByRole("checkbox", { name: "This room takes questions" })).toBeChecked();
  });

  it("calls the tool with the room and the new state when the leader flips it", async () => {
    const client = clientWith([thread({ leader: true })]);
    show(client);
    await userEvent.click(await screen.findByRole("checkbox", { name: "This room takes questions" }));
    expect(client.setQuestionRoom).toHaveBeenCalledWith("r1", true);
    expect(await screen.findByRole("checkbox", { name: "This room takes questions" })).toBeChecked();
  });

  it("hides the switch from a member", async () => {
    show(clientWith([thread({ questionRoom: true })]));
    await screen.findByRole("button", { name: "Ask a question" });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
