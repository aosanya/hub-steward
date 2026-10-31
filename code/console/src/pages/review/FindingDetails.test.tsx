import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Finding } from "../../data/reviewApi";
import { I18nProvider } from "../../i18n";
import { callTool } from "../../wakala/mcp";
import { answerWith, english } from "../spec/profileTesting";
import { FindingDetails } from "./FindingDetails";

vi.mock("../../wakala/mcp");

const finding = (over: Partial<Finding>): Finding => ({
  id: "f1",
  area_id: "a1",
  title: "",
  detail: "",
  tool: "",
  arguments: {},
  then: [],
  status: "open",
  fate: "new",
  fate_reason: "",
  carried_from_id: "",
  comments: [],
  ...over,
});

const show = (over: Partial<Finding>) =>
  render(
    <I18nProvider initial={english}>
      <FindingDetails hubId="h1" finding={finding(over)} />
    </I18nProvider>,
  );

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  answerWith({
    agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
    agency_list_goals: {
      items: [{ id: "g2", code: "G-2", title: "Sell produce together", description: "Pool the harvest." }],
    },
    agency_list_objectives: { items: [] },
    agency_list_roles: { items: [{ id: "r50", code: "R-50", name: "Group coordinator", description: "" }] },
  });
});

describe("the details of a review finding", () => {
  it("spells out the goal named by the finding's arguments", async () => {
    show({
      title: "Give the goal an owner",
      detail: "Nobody answers for it.",
      tool: "agency_update_goal",
      arguments: { goal_id: "g2", owner: "Manager" },
    });

    expect(await screen.findByText("G-2 · Sell produce together")).toBeInTheDocument();
    expect(screen.getByText("Pool the harvest.")).toBeInTheDocument();
    expect(screen.getByText("Give the goal an owner — Nobody answers for it.")).toBeInTheDocument();
  });

  it("spells out the goal named by a code in the finding's title", async () => {
    show({ title: "G-2 has no owner" });

    expect(await screen.findByText("G-2 · Sell produce together")).toBeInTheDocument();
  });

  it("shows the role a finding names by its code", async () => {
    show({ title: "Describe Group coordinator R-50", detail: "R-50 has no description, so nobody can tell what the seat is for." });

    expect(await screen.findByText("R-50 · Group coordinator")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
  });

  it("says nothing more is known when the finding names nothing the draft has", async () => {
    show({ title: "Think about a measure", arguments: { goal_id: "g99" } });

    expect(await screen.findByText("Nothing more is known about what this names.")).toBeInTheDocument();
    expect(screen.queryByText(/G-2/)).not.toBeInTheDocument();
  });

  it("says nothing more is known for a finding with no tool and no arguments", async () => {
    show({ title: "Rethink the plan" });

    expect(await screen.findByText("Nothing more is known about what this names.")).toBeInTheDocument();
  });

  it("says the load failed when the draft cannot be read", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("down"));
    show({ title: "G-2 has no owner" });

    expect(await screen.findByText(english.en["loadFailed"] as string)).toBeInTheDocument();
  });
});
