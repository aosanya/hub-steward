import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { resetMcp } from "../../shared/wakala/mcp";
import { MayFailedLine } from "./MayFailedLine";
import { retryMay } from "./mayStore";
import { useMayAnswer } from "./useMay";

const calls: string[] = [];
let failures = 0;

vi.mock("../../shared/wakala/mcp", async (original) => ({
  ...(await original<typeof import("../../shared/wakala/mcp")>()),
  callTool: vi.fn(async () => {
    calls.push("agency_get_my_roles");
    if (failures > 0) {
      failures -= 1;
      throw new Error("the hub did not answer");
    }
    return { permissions: ["resident.read"] };
  }),
}));

vi.mock("../../shared/wakala/openAgency", () => ({ openAgencyId: () => "agency-1" }));

function Card() {
  const answer = useMayAnswer("resident.read");
  return <p>{`${String(answer.may)} ${String(answer.known)} ${String(answer.failed)}`}</p>;
}

describe("the permission read across a sign-in", () => {
  beforeEach(() => {
    failures = 0;
    act(() => retryMay());
    calls.length = 0;
  });

  it("clears the failed line and reads again when the session is reset", async () => {
    failures = 100;
    render(
      <>
        <Card />
        <MayFailedLine />
      </>,
    );
    await waitFor(() => expect(screen.getAllByText(/Could not check what you may do/).length).toBe(1));
    const before = calls.length;
    failures = 0;
    act(() => resetMcp());
    await waitFor(() => expect(screen.getByText("true true false")).toBeTruthy());
    expect(screen.queryByText(/Could not check what you may do/)).toBeNull();
    expect(calls.length).toBeGreaterThan(before);
  });

  it("starts a new sign-in with no failed line when nothing was read yet", async () => {
    failures = 100;
    const first = render(<MayFailedLine />);
    const card = render(<Card />);
    await waitFor(() => expect(screen.getAllByText(/Could not check what you may do/).length).toBe(1));
    card.unmount();
    first.unmount();
    failures = 0;
    act(() => resetMcp());
    render(<MayFailedLine />);
    expect(screen.queryByText(/Could not check what you may do/)).toBeNull();
  });
});
