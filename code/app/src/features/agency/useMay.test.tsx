import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MayFailedLine } from "./MayFailedLine";
import { retryMay } from "./mayStore";
import { useMay, useMayAnswer } from "./useMay";

const calls: string[] = [];
let failures = 0;

vi.mock("../../shared/wakala/mcp", () => ({
  callTool: vi.fn(async () => {
    calls.push("agency_get_my_roles");
    if (failures > 0) {
      failures -= 1;
      throw new Error("the hub did not answer");
    }
    return { permissions: ["resident.read"] };
  }),
  forgetReads: vi.fn(),
}));

vi.mock("../../shared/wakala/openAgency", () => ({ openAgencyId: () => "agency-1" }));

function Both({ permission }: { permission: string }) {
  const may = useMay(permission);
  const answer = useMayAnswer(permission);
  return <p>{`${String(may)} ${String(answer.may)} ${String(answer.known)}`}</p>;
}

describe("useMay and useMayAnswer", () => {
  beforeEach(() => {
    calls.length = 0;
    failures = 0;
    act(() => retryMay());
    calls.length = 0;
  });

  it("agree on a permission the caller holds, and the answer is known once read", async () => {
    render(<Both permission="resident.read" />);
    expect(screen.getByText("false false false")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("true true true")).toBeTruthy());
  });

  it("agree on a permission the caller does not hold", async () => {
    render(<Both permission="group.manage" />);
    await waitFor(() => expect(screen.getByText("false false true")).toBeTruthy());
  });

  it("read the roles once each, through one shared read", async () => {
    render(<Both permission="resident.read" />);
    await waitFor(() => expect(screen.getByText("true true true")).toBeTruthy());
    expect(calls.length).toBe(2);
  });

  it("reads again once when the first read fails, and the answer then arrives", async () => {
    failures = 1;
    render(<Both permission="resident.read" />);
    await waitFor(() => expect(screen.getByText("true true true")).toBeTruthy());
    expect(calls.length).toBe(3);
  });

  it("says the read failed after the second failure, and the act stays unavailable", async () => {
    failures = 4;
    function Failed() {
      const answer = useMayAnswer("resident.read");
      return <p>{`${String(answer.may)} ${String(answer.known)} ${String(answer.failed)}`}</p>;
    }
    render(<Failed />);
    await waitFor(() => expect(screen.getByText("false true true")).toBeTruthy());
  });

  it("shows nothing when the read worked", async () => {
    render(
      <>
        <Both permission="resident.read" />
        <MayFailedLine />
      </>,
    );
    await waitFor(() => expect(screen.getByText("true true true")).toBeTruthy());
    expect(screen.queryByText(/Could not check what you may do/)).toBeNull();
  });

  it("shows one quiet line with a retry after the second failure, and the act returns on retry", async () => {
    failures = 100;
    render(
      <>
        <Both permission="resident.read" />
        <Both permission="group.manage" />
        <MayFailedLine />
      </>,
    );
    await waitFor(() => expect(screen.getAllByText(/Could not check what you may do/).length).toBe(1));
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    failures = 0;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getAllByText("true true true").length).toBe(1));
    expect(screen.queryByText(/Could not check what you may do/)).toBeNull();
  });

  it("clears the line when a later page reads the permissions again and it works", async () => {
    failures = 100;
    render(<MayFailedLine />);
    const first = render(<Both permission="resident.read" />);
    await waitFor(() => expect(screen.getAllByText(/Could not check what you may do/).length).toBe(1));
    first.unmount();
    failures = 0;
    render(<Both permission="group.manage" />);
    await waitFor(() => expect(screen.getByText("false false true")).toBeTruthy());
    expect(screen.queryByText(/Could not check what you may do/)).toBeNull();
  });
});
