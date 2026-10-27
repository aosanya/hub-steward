import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickerOptions } from "./pickerOptions";
import { clearPages, installPage } from "./testing";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

beforeEach(() => {
  clearPages();
});

describe("the choices taken from the rows of another page", () => {
  it("asks the source page for its rows for the open hub", async () => {
    const rows = installPage("groups");

    await pickerOptions("groups", "h1");

    expect(rows.mock.calls).toEqual([["h1", {}]]);
  });

  it("names a group by its group name and takes its id as the value", async () => {
    installPage("groups", { rows: [{ id: "g-1", group: "Riders", title: "ignored" }] });

    expect(await pickerOptions("groups", "h1")).toEqual([{ value: "g-1", label: "Riders" }]);
  });

  it("names a row by its title when it has no group name", async () => {
    installPage("goals", { rows: [{ id: "g-9", title: "Seed library" }] });

    expect(await pickerOptions("goals", "h1")).toEqual([{ value: "g-9", label: "Seed library" }]);
  });

  it("names a row by its id when it has neither a group name nor a title", async () => {
    installPage("goals", { rows: [{ id: "g-3" }] });

    expect(await pickerOptions("goals", "h1")).toEqual([{ value: "g-3", label: "g-3" }]);
  });

  it("offers the languages of the first general row, each as its own value and name", async () => {
    installPage("general", { rows: [{ languages: ["en", "hu"] }, { languages: ["de"] }] });

    expect(await pickerOptions("general", "h1")).toEqual([
      { value: "en", label: "en" },
      { value: "hu", label: "hu" },
    ]);
  });

  it("offers no language when the general page has no rows or no languages", async () => {
    installPage("general", { rows: [] });
    expect(await pickerOptions("general", "h1")).toEqual([]);

    installPage("general", { rows: [{ joining: "Open to join" }] });
    expect(await pickerOptions("general", "h1")).toEqual([]);
  });

  it("offers nothing when the source page has no rows", async () => {
    installPage("groups", { rows: [] });

    expect(await pickerOptions("groups", "h1")).toEqual([]);
  });

  it("offers nothing when the rows cannot be loaded", async () => {
    installPage("groups", {
      rows: async () => {
        throw new Error("offline");
      },
    });

    expect(await pickerOptions("groups", "h1")).toEqual([]);
  });

  it("offers nothing when the console has no module for the source page", async () => {
    expect(await pickerOptions("groups", "h1")).toEqual([]);
  });
});
