import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
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

describe("a menu section's screen", () => {
  it("lists the section's submenus under its name", () => {
    section("issues");

    expect(screen.getByRole("heading", { name: "Issues & Requests" })).toBeInTheDocument();
    ["All Issues", "Assigned to Me", "Overdue", "Map View", "Service Types"].forEach((title) => expect(screen.getByText(title)).toBeInTheDocument());
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
