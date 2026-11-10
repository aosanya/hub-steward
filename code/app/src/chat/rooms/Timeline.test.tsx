import { render, screen } from "@testing-library/react";
import type { RoomMessage, RoomsClient } from "./api";
import { Timeline } from "./Timeline";
import { dayLabel, timeOf } from "./time";

const message = (over: Partial<RoomMessage>): RoomMessage => ({
  id: "m",
  author: "Grace Adhiambo",
  agent: false,
  mine: false,
  body: "",
  at: "2026-10-28T09:12:00Z",
  kind: "",
  targetId: "",
  ...over,
});

const show = (messages: RoomMessage[]) => render(<Timeline messages={messages} threadLabel="Seed" client={{} as RoomsClient} openAsk={vi.fn()} />);

describe("room timeline", () => {
  it("shows the author and time of each message, and calls my own 'You'", () => {
    show([
      message({ id: "1", body: "Trucks arrive Friday" }),
      message({ id: "2", body: "Thanks", mine: true, author: "Amina", at: "2026-10-28T09:40:00Z" }),
    ]);
    expect(screen.getByText("Grace Adhiambo")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.queryByText("Amina")).not.toBeInTheDocument();
    expect(screen.getByText(`· ${timeOf("2026-10-28T09:12:00Z")}`)).toBeInTheDocument();
    expect(screen.getByText("Trucks arrive Friday")).toBeInTheDocument();
  });

  it("marks a message from the agent", () => {
    show([message({ id: "1", agent: true, author: "Helper", body: "Hello" })]);
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("puts one day heading above the first message of each day", () => {
    show([
      message({ id: "1", at: "2026-10-27T08:00:00Z", body: "First" }),
      message({ id: "2", at: "2026-10-27T09:00:00Z", body: "Second" }),
      message({ id: "3", at: "2026-10-29T09:00:00Z", body: "Third" }),
    ]);
    const headings = document.querySelectorAll(".rm-day");
    expect(headings).toHaveLength(2);
    expect(headings[0].textContent).toBe(dayLabel("2026-10-27T08:00:00Z"));
    expect(headings[1].textContent).toBe(dayLabel("2026-10-29T09:00:00Z"));
  });

  it("shows nothing for an empty thread and no attachment for a plain message", () => {
    const { container } = show([]);
    expect(container.querySelectorAll(".rm-entry")).toHaveLength(0);
    show([message({ id: "1", body: "Plain" })]);
    expect(document.querySelectorAll(".attached")).toHaveLength(0);
  });
});
