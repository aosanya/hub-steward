import { vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

const listedWords = {
  modules: [
    { module: "agency", mounts: [{ name: "agency", words: { "Agency Profile": "Municipality Profile" } }] },
    { module: "actor", mounts: [{ name: "Residents", words: { "Boundaries & Areas": "Boundaries & Wards" } }] },
  ],
};

const answer = (withWords: boolean) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name) => {
    switch (name) {
      case "agency_get_agency":
        return { name: "Zoldhalom" };
      case "agency_list_mounts":
        return withWords ? listedWords : { modules: [] };
      case "instance_get_languages":
        return { content: ["en"] };
      case "actor_list_groups":
        return { items: [] };
      default:
        throw new Error(`unexpected tool ${name}`);
    }
  });

const openAt = (title: string) =>
  render(
    <MemoryRouter initialEntries={[items.find((item) => item.title === title)!.path!()]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => openAgency("town"));

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

describe("the Settings screens when the agency lists its own words", () => {
  it("titles the profile screen with the agency's word", async () => {
    answer(true);
    openAt("Agency Profile");

    expect(await screen.findByRole("heading", { name: "Municipality Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Agency Profile" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Rename" })).toBeInTheDocument();
  });

  it("titles the areas screen and words its empty state with the agency's word", async () => {
    answer(true);
    openAt("Boundaries & Areas");

    expect(await screen.findByRole("heading", { name: "Boundaries & Wards" })).toBeInTheDocument();
    expect(await screen.findByText("No boundaries & wards have been added yet.")).toBeInTheDocument();
  });
});

describe("the Settings screens when the agency lists no words", () => {
  it("shows the generic profile title", async () => {
    answer(false);
    openAt("Agency Profile");

    expect(await screen.findByRole("heading", { name: "Agency Profile" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Rename" })).toBeInTheDocument();
  });

  it("shows the generic areas title and empty state", async () => {
    answer(false);
    openAt("Boundaries & Areas");

    expect(await screen.findByRole("heading", { name: "Boundaries & Areas" })).toBeInTheDocument();
    expect(await screen.findByText("No areas have been added yet.")).toBeInTheDocument();
  });
});
