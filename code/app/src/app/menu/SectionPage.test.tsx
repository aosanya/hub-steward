import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import type { AgencyView } from "../../features/agency/modules";
import { SectionPage } from "./SectionPage";

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const section = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/a/town/menu/${id}`]}>
      <Routes>
        <Route path="/a/:agencyId/menu/:sectionId" element={<SectionPage />} />
        <Route path="/a/:agencyId/home" element={null} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

const withVoting: AgencyView = { name: "Town", modules: [{ code: "voting", name: "Voting" }] };

const withoutVoting: AgencyView = { name: "Town", modules: [{ code: "taskmanager", name: "Tasks" }] };

const issuesOf = (view: AgencyView) =>
  render(
    <MemoryRouter initialEntries={["/a/town/menu/issues"]}>
      <Routes>
        <Route path="/a/:agencyId/menu/:sectionId" element={<SectionPage agency={{ read: async () => view }} />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

describe("the Question row of Issues & Requests", () => {
  it("lists Question after Send a Wish when the agency has the voting module, and opens the Question screen", async () => {
    const { container } = issuesOf(withVoting);

    await screen.findByText("Question");
    expect(Array.from(container.querySelectorAll(".rows .ttl")).map((title) => title.textContent)).toEqual(["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types", "Wishes", "Send a Wish", "Question", "Rounds by Neighbourhood"]);
    await userEvent.click(screen.getByText("Question"));
    expect(landed).toBe("/a/town/question");
  });

  it("leaves Question out when the agency has no voting module", async () => {
    issuesOf(withoutVoting);

    await screen.findByText("Wishes");
    expect(screen.queryByText("Question")).toBeNull();
  });
});

describe("a menu section's screen", () => {
  it("lists the section's submenus under its name", () => {
    section("issues");

    expect(screen.getByRole("heading", { name: "Issues & Requests" })).toBeInTheDocument();
    ["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types", "Wishes", "Send a Wish", "Rounds by Neighbourhood"].forEach((title) => expect(screen.getByText(title)).toBeInTheDocument());
  });

  it("lists Send a Wish as the seventh Issues & Requests row, after Wishes", () => {
    const { container } = section("issues");

    const rows = Array.from(container.querySelectorAll(".rows .ttl")).map((title) => title.textContent);

    expect(rows).toEqual(["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types", "Wishes", "Send a Wish", "Rounds by Neighbourhood"]);
  });

  it("opens Wishes on the wishes screen of the Issues & Requests menu", async () => {
    section("issues");

    await userEvent.click(screen.getByRole("button", { name: /Wishes/ }));

    expect(landed).toBe("/a/town/menu/issues/wishes");
  });

  it("opens a submenu that has a screen", async () => {
    section("issues");

    await userEvent.click(screen.getByRole("button", { name: /Overdue/ }));

    expect(landed).toBe("/a/town/council/late-matters");
  });

  it("opens Applications on the list of sent applications", async () => {
    section("services");

    await userEvent.click(screen.getByRole("button", { name: /Applications/ }));

    expect(landed).toBe("/a/town/menu/services/applications");
  });

  it("goes back to Home for a section it does not know", () => {
    section("unknown");

    expect(landed).toBe("/a/town/home");
  });

  it("has a Back button reading Home that goes to Home", async () => {
    section("issues");

    const back = screen.getByRole("button", { name: /Home/ });
    expect(back).toBeInTheDocument();
    await userEvent.click(back);

    expect(landed).toBe("/a/town/home");
  });
});
