import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { callTool } from "../../wakala/mcp";
import { ConsequencesView } from "../views/ConsequencesView";
import { ThreatsView } from "../views/ThreatsView";
import { openLibrary } from "./libraryTesting";

vi.mock("../../wakala/mcp");

const shared = {
  agency_list_hazards: { items: [{ id: "h1", code: "H-1", title: "Flood" }] },
  agency_list_risks: { items: [] },
  agency_list_unguarded_parts: { items: [] },
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the hazard line of a library row", () => {
  it("shows the hazard of a consequence on its own line", async () => {
    await openLibrary(
      <ConsequencesView />,
      "consequences",
      { ...shared, agency_list_consequences: { items: [{ id: "q1", code: "Q-1", title: "Crop loss", description: "Fields lost", hazard_code: "H-1" }] }, agency_list_risk_consequences: { items: [] } },
    );
    await userEvent.click(await screen.findByRole("button", { name: "Q-1 · Crop loss" }));
    const link = await screen.findByRole("link", { name: "Flood" });
    expect(link).toHaveAttribute("href", expect.stringContaining("open=h1"));
    expect(link.closest("dd")?.previousElementSibling).toHaveTextContent("Related hazard");
  });

  it("flags a consequence that names no hazard", async () => {
    await openLibrary(
      <ConsequencesView />,
      "consequences",
      { ...shared, agency_list_consequences: { items: [{ id: "q2", code: "Q-2", title: "Distress sale" }] }, agency_list_risk_consequences: { items: [] } },
    );
    await userEvent.click(await screen.findByRole("button", { name: "Q-2 · Distress sale" }));
    expect((await screen.findAllByText("None")).length).toBeGreaterThan(0);
  });

  it("shows no hazard line on a threat", async () => {
    await openLibrary(
      <ThreatsView />,
      "threats",
      { ...shared, agency_list_threats: { items: [{ id: "t1", code: "T-1", title: "Storm", hazard_code: "H-1" }] }, agency_list_risk_threats: { items: [] } },
    );
    await userEvent.click(await screen.findByRole("button", { name: "T-1 · Storm" }));
    expect(screen.queryByText(/^Related hazard/)).toBeNull();
  });
});

describe("the rows of a library table", () => {
  const storms = { ...shared, agency_list_threats: { items: [{ id: "t1", code: "T-1", title: "Storm" }, { id: "t2", code: "T-2", title: "Drought" }, { id: "t3", code: "T-3", title: "Theft" }] }, agency_list_risk_threats: { items: [] } };

  it("lists them by title", async () => {
    await openLibrary(<ThreatsView />, "threats", storms);
    await screen.findByText("T-1 · Storm");
    expect(screen.getAllByRole("button", { name: /^T-/ }).map((button) => button.textContent)).toEqual(["T-2 · Drought", "T-1 · Storm", "T-3 · Theft"]);
  });

  it("narrows them to the ones matching the search", async () => {
    await openLibrary(<ThreatsView />, "threats", storms);
    await screen.findByText("T-1 · Storm");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search threats" }), "sto");
    expect(screen.getAllByRole("button", { name: /^T-/ })).toHaveLength(1);
    expect(screen.getByText("T-1 · Storm")).toBeInTheDocument();
  });
});
