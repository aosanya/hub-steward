import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { QuestionScreen } from "./QuestionScreen";

const base = "https://wakala.test/instances/farmers/voting/polls";

const poll = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  question: "Which evening suits the open council meeting",
  mode: "one",
  group_ids: ["town-hall"],
  opens_at: "2026-11-01T00:00:00Z",
  closes_at: "2026-12-01T00:00:00Z",
  state: "open",
  choices: [
    { id: "c1", label: "Wednesday evening", position: 1 },
    { id: "c2", label: "Friday evening", position: 2 },
  ],
  answered: false,
  mine: true,
  in_audience: false,
  ...over,
});

const count = {
  poll_id: "p1",
  choices: [
    { choice_id: "c1", label: "Wednesday evening", position: 1, votes: 1 },
    { choice_id: "c2", label: "Friday evening", position: 2, votes: 0 },
  ],
  answered: 1,
};

const hub = (open: unknown[]) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === `${base}/open`) return new Response(JSON.stringify(open), { status: 200 });
      if (url === `${base}/p1/count`) return new Response(JSON.stringify(count), { status: 200 });
      return new Response("{}", { status: 404 });
    }),
  );

const show = () =>
  render(
    <MemoryRouter initialEntries={["/a/farmers/question"]}>
      <QuestionScreen />
    </MemoryRouter>,
  );

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  vi.unstubAllGlobals();
  forgetOpenAgency();
});

describe("the question screen for the person who asked", () => {
  it("shows the asker the question and its count although they are not in its group", async () => {
    hub([poll()]);
    show();
    expect(await screen.findByText("Which evening suits the open council meeting")).toBeInTheDocument();
    expect(await screen.findByText("Wednesday evening: 1")).toBeInTheDocument();
    expect(screen.getByText("1 answered")).toBeInTheDocument();
    expect(screen.getByText("You asked this")).toBeInTheDocument();
  });

  it("offers the asker no choice to pick and no Send when they are outside the audience", async () => {
    hub([poll()]);
    show();
    await screen.findByText("1 answered");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  });

  it("still offers Send to an asker who is in the audience", async () => {
    hub([poll({ in_audience: true })]);
    show();
    expect(await screen.findByRole("radio", { name: "Wednesday evening" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.getByText("You asked this")).toBeInTheDocument();
  });

  it("offers Send to a member of the audience who did not ask, with no mark", async () => {
    hub([poll({ mine: false, in_audience: true })]);
    show();
    expect(await screen.findByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByText("You asked this")).toBeNull();
  });

  it("treats a hub that does not say who is in the audience as the audience", async () => {
    const { in_audience, mine, ...old } = poll();
    hub([old]);
    show();
    expect(await screen.findByRole("button", { name: "Send" })).toBeInTheDocument();
  });
});
