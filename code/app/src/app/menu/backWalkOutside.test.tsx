import { holdGroupIn } from "../../shared/testing/holdGroup";
import { vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "../App";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import * as mcp from "../../shared/wakala/mcp";
import * as me from "../../shared/wakala/me";

let landed = "";

function Where() {
  landed = useLocation().pathname;
  return null;
}

const ways: Record<string, string> = {
  "/a/town/backlogs": "/a/town/home",
  "/a/town/backlogs/new": "/a/town/backlogs",
  "/a/town/backlogs/b1": "/a/town/backlogs",
  "/a/town/backlogs/issue/i1": "/a/town/backlogs/all",
  "/a/town/files": "/a/town/home",
  "/a/town/files/f1": "/a/town/files",
  "/a/town/files/f1/file": "/a/town/files",
  "/apps/buy": "/a/town/do-something",
  "/apps/sell": "/a/town/do-something",
  "/profile": "/a/town/home",
  "/language": "/a/town/home",
  "/sign-out": "/a/town/home",
};

beforeEach(() => {
  openAgency("town");
  holdGroupIn("town");
  vi.spyOn(mcp, "callTool").mockImplementation(async () => ({}) as never);
  vi.spyOn(me, "checkSession").mockResolvedValue("in" as never);
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the back control of the pages outside the screen registry, opened by their address", () => {
  it.each(Object.entries(ways))("%s has a named Back control that goes to its parent", async (path, parent) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where />
      </MemoryRouter>,
    );

    await waitFor(() => expect(document.querySelector(".back")).not.toBeNull());

    await userEvent.click(document.querySelector(".back") as HTMLElement);

    expect(landed).toBe(parent);
  });
});
