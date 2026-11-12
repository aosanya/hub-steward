import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { callTool } from "../../wakala/mcp";
import { currentAddress } from "../models/locationSpy";
import { renderConsentAt, settle } from "./consentTesting";

vi.mock("../../wakala/mcp");

const versions = {
  items: [
    { id: "c3", version: "v3", published_at: "2026-06-09T10:00:00Z", in_force: true },
    { id: "c2", version: "v2", published_at: "2026-01-14T10:00:00Z", in_force: false },
    { id: "c1", version: "v1", published_at: "2025-11-03T10:00:00Z", in_force: false },
  ],
};

const serve = (answer: unknown) => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (_hub, tool) => {
    if (answer instanceof Error) throw answer;
    return tool === "custody_list_consent_versions" ? answer : {};
  });
};

const open = async (answer: unknown = versions) => {
  serve(answer);
  renderConsentAt("/h/h1/consent");
  await settle();
};

const rowOf = (name: string) => screen.getByText(name, { selector: ".cell-name" }).closest("tr") as HTMLElement;

describe("the Consent text page", () => {
  it("is titled Consent text and reads the versions with custody_list_consent_versions", async () => {
    await open();
    expect(screen.getByRole("heading", { level: 1, name: "Consent text" })).toBeInTheDocument();
    expect(callTool).toHaveBeenCalledWith("h1", "custody_list_consent_versions");
  });

  it("lists each version with the day it was published, newest first", async () => {
    await open();
    const names = Array.from(document.querySelectorAll("tbody .cell-name")).map((cell) => cell.textContent);
    expect(names).toEqual(["Version 3", "Version 2", "Version 1"]);
    expect(within(rowOf("Version 3")).getByText("9 Jun 2026")).toBeInTheDocument();
    expect(within(rowOf("Version 1")).getByText("3 Nov 2025")).toBeInTheDocument();
  });

  it("marks the version in force and the others as replaced", async () => {
    await open();
    expect(within(rowOf("Version 3")).getByText("In force")).toHaveClass("tag", "ok");
    expect(within(rowOf("Version 2")).getByText("Replaced")).toHaveClass("soft");
    expect(screen.getAllByText("In force")).toHaveLength(1);
  });

  it("says no version has been published while the list is empty", async () => {
    await open({ items: [] });
    expect(screen.getByText("No version has been published yet.")).toBeInTheDocument();
  });

  it("says the page could not be loaded when the tool fails", async () => {
    await open(new Error("instance not found"));
    expect(screen.getByText("The page could not be loaded.")).toBeInTheDocument();
  });

  it("opens the New version form from the primary button", async () => {
    await open();
    await userEvent.click(screen.getByRole("link", { name: "New version" }));
    await settle();
    expect(currentAddress()).toBe("/h/h1/consent/new");
    expect(screen.getByRole("heading", { level: 1, name: "New version" })).toBeInTheDocument();
  });
});
