import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNoticeState } from "../../shell/useNoticeState";
import { NoticeBar, NoticeCtx } from "../../ui";
import { callTool } from "../../wakala/mcp";
import { answering, callsTo, renderView } from "../spec/usersTesting";
import { GroupBoundary } from "./GroupBoundary";

vi.mock("../../wakala/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wakala/mcp")>()),
  callTool: vi.fn(),
}));

const ring = [
  [20, 47],
  [21, 47],
  [21, 48],
  [20, 47],
];

function View() {
  const notice = useNoticeState("h1");
  return (
    <NoticeCtx.Provider value={notice}>
      <NoticeBar />
      <GroupBoundary hubId="h1" groupId="g1" />
    </NoticeCtx.Provider>
  );
}

const show = (reply: unknown) => {
  answering({ actor_get_group: reply, actor_set_group_boundary: {} });
  return renderView("groups", View);
};

beforeEach(() => vi.mocked(callTool).mockReset());

describe("the boundary of a group", () => {
  it("draws the polygon the API returned and lists its corners", async () => {
    show({ id: "g1", boundary: { type: "Polygon", coordinates: [ring] } });
    expect(await screen.findByRole("img", { name: "Boundary drawing" })).toBeInTheDocument();
    expect(document.querySelectorAll("polygon")).toHaveLength(1);
    expect(screen.getByLabelText("Corners, one per line as longitude, latitude")).toHaveValue("20, 47\n21, 47\n21, 48");
    expect(callsTo("actor_get_group")).toEqual([{ group_id: "g1" }]);
  });

  it("says so when no boundary is set", async () => {
    show({ id: "g1" });
    expect(await screen.findByText("No boundary is set for this group.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear boundary" })).toBeDisabled();
  });

  it("sends the typed corners as a closed polygon", async () => {
    show({ id: "g1" });
    await userEvent.type(await screen.findByLabelText("Corners, one per line as longitude, latitude"), "20, 47{enter}21, 47{enter}21, 48");
    await userEvent.click(screen.getByRole("button", { name: "Save boundary" }));
    await waitFor(() =>
      expect(callsTo("actor_set_group_boundary")).toEqual([{ group_id: "g1", boundary: { type: "Polygon", coordinates: [ring] } }]),
    );
  });

  it("sends nothing and says why when fewer than three corners are given", async () => {
    show({ id: "g1" });
    await userEvent.type(await screen.findByLabelText("Corners, one per line as longitude, latitude"), "20, 47");
    await userEvent.click(screen.getByRole("button", { name: "Save boundary" }));
    expect(await screen.findByText("Give at least three corners, each as longitude, latitude.")).toBeInTheDocument();
    expect(callsTo("actor_set_group_boundary")).toEqual([]);
  });

  it("clears the boundary by sending none", async () => {
    show({ id: "g1", boundary: { type: "Polygon", coordinates: [ring] } });
    await userEvent.click(await screen.findByRole("button", { name: "Clear boundary" }));
    await waitFor(() => expect(callsTo("actor_set_group_boundary")).toEqual([{ group_id: "g1" }]));
  });
});
