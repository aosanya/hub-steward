import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AssignedIssueRows } from "./AssignedIssueRows";
import type { AssignedClient } from "./assignedIssues";
import { useAssignedIssues } from "./useAssignedIssues";

const issue = { id: "t1", code: "HS-002", title: "Review: the Review step", step: "review" };

const clientOf = (...issues: (typeof issue)[]): AssignedClient => ({ assigned: vi.fn().mockResolvedValue(issues) });

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

const shown = (client: AssignedClient) =>
  render(
    <MemoryRouter>
      <Routes>
        <Route path="*" element={<><AssignedIssueRows client={client} /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );

describe("the assigned issues in Needs you", () => {
  it("lists each by code and title and opens the issue when tapped", async () => {
    shown(clientOf(issue));
    await userEvent.click(await screen.findByRole("button", { name: /HS-002 Review: the Review step/ }));
    expect(screen.getByTestId("where").textContent).toMatch(/\/backlogs\/issue\/t1$/);
  });

  it("has nothing to list while the read is out or after it fails", async () => {
    const failing: AssignedClient = { assigned: vi.fn().mockRejectedValue(new Error("down")) };
    shown(failing);
    await waitFor(() => expect(failing.assigned).toHaveBeenCalled());
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reports failure so the count is not taken for none", async () => {
    const failing: AssignedClient = { assigned: vi.fn().mockRejectedValue(new Error("down")) };
    const { result } = renderHook(() => useAssignedIssues(failing));
    expect(result.current.value).toBeNull();
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.value).toBeNull();
  });
});
