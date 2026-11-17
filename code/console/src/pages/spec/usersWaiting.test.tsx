import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { NoticeCtx, type NoticeApi } from "../../ui";
import { callTool } from "../../wakala/mcp";
import { rest } from "../../wakala/rest";
import { UsersWaiting } from "./usersWaiting";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

vi.mock("../../wakala/rest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/rest")>()),
  rest: vi.fn(),
}));

const words = JSON.parse(readFileSync(resolve(__dirname, "../../../public/i18n.json"), "utf8"));

const call = vi.mocked(callTool);

const restCall = vi.mocked(rest);

const shown: string[] = [];

const notices: NoticeApi = { message: null, show: (text, kind) => shown.push(`${kind}:${text}`), dismiss: () => {} };

const requests = [
  { id: "r1", actorId: "a2", name: "Brian Ochieng", group: "Siaya farmers", level: "group" },
  { id: "r2", actorId: "a3", name: "Wanjiru Kamau", group: "Siaya farmers", level: "group" },
];

const resident = { id: "u9", actorId: "u9", name: "Resident Nine", group: "", level: "agency" };

const decided = vi.fn();

const open = (list: typeof requests = requests) =>
  render(
    <I18nProvider initial={words}>
      <NoticeCtx.Provider value={notices}>
        <UsersWaiting hubId="h1" requests={list as any} onDecided={decided} />
      </NoticeCtx.Provider>
    </I18nProvider>,
  );

beforeEach(() => {
  call.mockReset();
  restCall.mockReset();
  restCall.mockResolvedValue({ ok: true, status: 204, data: null });
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

describe("the waiting rows for a resident who asked to join the agency", () => {
  it("lists the resident with Approve and Decline", () => {
    open([resident]);

    expect(screen.getByText("Resident Nine")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("approves through the agency join-requests route and not the group tool", async () => {
    open([resident]);

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(screen.queryByText("Resident Nine")).not.toBeInTheDocument());
    expect(restCall).toHaveBeenCalledWith("POST", "/instances/h1/join-requests/u9/approve");
    expect(call).not.toHaveBeenCalled();
    expect(decided).toHaveBeenCalledTimes(1);
  });

  it("declines quietly through the agency join-requests route and not the group tool", async () => {
    open([resident]);

    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    await userEvent.click(screen.getByRole("button", { name: "Decline quietly" }));

    await waitFor(() => expect(screen.queryByText("Resident Nine")).not.toBeInTheDocument());
    expect(restCall).toHaveBeenCalledWith("POST", "/instances/h1/join-requests/u9/refuse");
    expect(call).not.toHaveBeenCalled();
    expect(decided).toHaveBeenCalledTimes(1);
  });

  it("says the approval failed and keeps the row when the route refuses", async () => {
    restCall.mockResolvedValue({ ok: false, status: 409, data: { error: "already decided" } });
    open([resident]);

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(shown).toEqual(["bad:The request could not be approved."]));
    expect(screen.getByText("Resident Nine")).toBeInTheDocument();
  });
});
