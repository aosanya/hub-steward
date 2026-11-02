import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { NoticeCtx, type NoticeApi } from "../../ui";
import { callTool } from "../../wakala/mcp";
import { UsersWaiting } from "./usersWaiting";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

const call = vi.mocked(callTool);

const shown: string[] = [];

const notices: NoticeApi = { message: null, show: (text, kind) => shown.push(`${kind}:${text}`), dismiss: () => {} };

const requests = [
  { id: "r1", actorId: "a2", name: "Brian Ochieng", group: "Siaya farmers" },
  { id: "r2", actorId: "a3", name: "Wanjiru Kamau", group: "Siaya farmers" },
];

const decided = vi.fn();

const open = () =>
  render(
    <I18nProvider initial={words}>
      <NoticeCtx.Provider value={notices}>
        <UsersWaiting hubId="h1" requests={requests} onDecided={decided} />
      </NoticeCtx.Provider>
    </I18nProvider>,
  );

beforeEach(() => {
  call.mockReset();
  decided.mockReset();
  shown.length = 0;
});

describe("the waiting rows when a decision is refused", () => {
  it("says the approval failed, keeps the row, and asks for a fresh list", async () => {
    call.mockRejectedValue(new Error("actor_operator_approve_join_request: request already decided"));
    open();

    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);

    await waitFor(() => expect(shown).toEqual(["bad:The request could not be approved."]));
    expect(screen.getByText("Brian Ochieng")).toBeInTheDocument();
    expect(decided).toHaveBeenCalledTimes(1);
  });

  it("says the decline failed and keeps the question open", async () => {
    call.mockRejectedValue(new Error("down"));
    open();

    await userEvent.click(screen.getAllByRole("button", { name: "Decline" })[1]);
    await userEvent.click(screen.getByRole("button", { name: "Decline quietly" }));

    await waitFor(() => expect(shown).toEqual(["bad:The request could not be declined."]));
    expect(screen.getByText("Decline Wanjiru Kamau's request to join Siaya farmers?")).toBeInTheDocument();
  });

  it("closes the question once the decline went through, leaving the other row waiting", async () => {
    call.mockResolvedValue({});
    open();

    await userEvent.click(screen.getAllByRole("button", { name: "Decline" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Decline quietly" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Decline quietly" })).not.toBeInTheDocument());
    expect(screen.queryByText("Brian Ochieng")).not.toBeInTheDocument();
    expect(screen.getByText("Wanjiru Kamau")).toBeInTheDocument();
  });

  it("takes a decided row out at once, leaving the other waiting", async () => {
    call.mockResolvedValue({});
    open();

    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);

    await waitFor(() => expect(screen.queryByText("Brian Ochieng")).not.toBeInTheDocument());
    expect(screen.getByText("Wanjiru Kamau")).toBeInTheDocument();
    expect(shown).toEqual([]);
  });
});
