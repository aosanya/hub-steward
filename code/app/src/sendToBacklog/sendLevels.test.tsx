import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openAgency } from "../agency/open";
import { SendBar } from "./SelectionControls";
import { canSendFrom } from "./leftOut";
import { SendToBacklogButton } from "./SendToBacklogButton";
import type { SendClient, Target } from "./types";
import { outcomeWords, someOnlySeenWords } from "./words";

const software: Target = { backlogId: "b1", name: "Software", stepId: "s1", stepName: "To do" };
const documentation: Target = { backlogId: "b2", name: "Documentation", stepId: "d1", stepName: "Draft" };

const clientOf = (targets: Target[]): SendClient => ({ targets: async () => targets, send: vi.fn() });

beforeEach(() => {
  vi.restoreAllMocks();
  openAgency("hub-1");
});

describe("which issues a person may send", () => {
  it("needs Can move on the backlog each issue is in", () => {
    expect(canSendFrom([documentation], ["b1"])).toBe(false);
    expect(canSendFrom([software, documentation], ["b1"])).toBe(true);
    expect(canSendFrom([software, documentation], ["b1", "b2"])).toBe(true);
    expect(canSendFrom([documentation], ["b2", "b1"])).toBe(false);
  });

  it("does not hold back an issue that names no backlog, or an empty choice", () => {
    expect(canSendFrom([documentation], [""])).toBe(true);
    expect(canSendFrom([documentation], [])).toBe(true);
  });
});

describe("the button on an opened issue", () => {
  it("is not offered when the person can only see the issue's own backlog", async () => {
    render(<SendToBacklogButton issueId="t1" from={["b1"]} client={clientOf([documentation])} />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Send to backlog" })).toBeNull());
  });

  it("is offered when the person can move in the issue's own backlog and another", async () => {
    render(<SendToBacklogButton issueId="t1" from={["b1"]} client={clientOf([software, documentation])} />);
    expect(await screen.findByRole("button", { name: "Send to backlog" })).toBeTruthy();
  });
});

describe("the bar over a selection", () => {
  it("is off, and says why, when a chosen issue is in a backlog the person can only see", async () => {
    render(<SendBar count={2} from={["b2", "b1"]} client={clientOf([documentation])} onSend={() => {}} />);
    expect(await screen.findByText(someOnlySeenWords)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send to backlog" })).toHaveProperty("disabled", true);
  });

  it("is on when the person can move in every chosen issue's backlog", async () => {
    render(<SendBar count={2} from={["b2", "b1"]} client={clientOf([software, documentation])} onSend={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Send to backlog" })).toHaveProperty("disabled", false));
    expect(screen.queryByText(someOnlySeenWords)).toBeNull();
  });
});

describe("a refused send", () => {
  it("reads the hub's reason as it came, whether it blames the level or the role", () => {
    expect(outcomeWords({ sent: 0, refusal: "this group's role is too small to move issues" }, 1, documentation)).toBe("0 of 1 sent to Documentation. this group's role is too small to move issues");
    expect(outcomeWords({ sent: 0, refusal: "backlog access forbidden: moving needs Can move on both backlogs" }, 1, documentation)).toBe("0 of 1 sent to Documentation. backlog access forbidden: moving needs Can move on both backlogs");
  });
});
