import { vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import { NeedsYouStripRow } from "./NeedsYouStrip";

const answerWith = (words?: Record<string, string>) => (_agency: string, name: string) => {
  if (name === "agency_get_agency") return Promise.resolve({ name: "Zoldhalom" });
  if (name === "agency_list_mounts") return Promise.resolve({ modules: [{ module: "actor", mounts: [{ name: "Residents", words }] }] });
  return Promise.reject(new Error(`${name}: unknown tool`));
};

const show = (words: Record<string, string> | undefined, count: number) => {
  vi.spyOn(mcp, "callTool").mockImplementation(answerWith(words) as typeof mcp.callTool);
  render(
    <MemoryRouter>
      <NeedsYouStripRow count={count} />
    </MemoryRouter>,
  );
};

beforeEach(() => openAgency("zoldhalom"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Home strip in the agency's words", () => {
  it("reads You have 3 tasks to do when the agency lists Things as Tasks", async () => {
    show({ Thing: "Task", Things: "Tasks" }, 3);
    await waitFor(() => expect(screen.getByRole("button", { name: /You have 3 tasks to do/ })).toBeTruthy());
  });

  it("reads You have 1 task to do for one", async () => {
    show({ Thing: "Task", Things: "Tasks" }, 1);
    await waitFor(() => expect(screen.getByRole("button", { name: /You have 1 task to do/ })).toBeTruthy());
  });

  it("reads today's text when the agency lists no words", async () => {
    show(undefined, 3);
    expect(screen.getByRole("button", { name: /You have 3 things to do/ })).toBeTruthy();
    await waitFor(() => expect(mcp.callTool).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /You have 3 things to do/ })).toBeTruthy();
  });
});
