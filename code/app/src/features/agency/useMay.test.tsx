import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useMay, useMayAnswer } from "./useMay";

const calls: string[] = [];

vi.mock("../../shared/wakala/mcp", () => ({
  callTool: vi.fn(async () => {
    calls.push("agency_get_my_roles");
    return { permissions: ["resident.read"] };
  }),
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
});
