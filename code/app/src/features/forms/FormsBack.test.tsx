import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import type { FormsClient } from "./api";
import { FormsProvider } from "./context";
import { FormsPage } from "./FormsPage";

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

const client: FormsClient = {
  waiting: async () => [],
  answered: async () => [],
  standing: async () => [],
  questions: async () => [],
  submit: async () => {},
};

const section = { path: "/a/town/menu/services", title: "Services & Permits" };

const formsOpenedWith = (state?: unknown) =>
  render(
    <FormsProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: "/a/town/forms", state }]}>
        <Routes>
          <Route path="/a/town/forms" element={<FormsPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>
    </FormsProvider>,
  );

describe("the forms list opened from a menu section", () => {
  it("offers a Back button named after the section and goes back to the section", async () => {
    formsOpenedWith({ from: section });
    await screen.findByText("Nothing is waiting for you");

    await userEvent.click(screen.getByRole("button", { name: /Services & Permits/ }));

    expect(landed).toBe(section.path);
  });

  it("offers no Back button when it was not opened from a section", async () => {
    formsOpenedWith();
    await screen.findByText("Nothing is waiting for you");

    expect(screen.queryByRole("button", { name: /‹/ })).toBeNull();
  });
});
