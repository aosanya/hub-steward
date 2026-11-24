import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { forgetAssumedGroup, rememberAssumedGroup } from "../shared/wakala/assumedGroup";
import { forgetOpenAgency, openAgency, rememberAgencyName } from "../shared/wakala/openAgency";
import { TopBar } from "./TopBar";

const emea = (count: number, agencyId = "hub-1") => ({ agencyId, id: "g1", name: "EMEA", count });

const bar = (back = false) =>
  render(
    <MemoryRouter>
      {back ? <TopBar back={{ onClick: () => undefined, label: "Home" }} title="Chat" menu /> : <TopBar title="Home" menu />}
    </MemoryRouter>,
  );

const banner = () => within(screen.getByRole("banner"));

beforeEach(() => {
  openAgency("hub-1");
  act(() => rememberAgencyName("Hub Steward SWE"));
});

afterEach(() => {
  act(() => {
    forgetAssumedGroup();
    rememberAgencyName("");
  });
  forgetOpenAgency();
});

describe("the bar and the assumed group", () => {
  it("names the assumed group after the hub", () => {
    act(() => rememberAssumedGroup(emea(2)));
    bar();
    expect(banner().getByText("Hub Steward SWE · EMEA")).toBeInTheDocument();
  });

  it("names the group of a person with one group and draws no switch, because there is nothing to switch to", () => {
    act(() => rememberAssumedGroup(emea(1)));
    bar();
    expect(banner().getByText("Hub Steward SWE · EMEA")).toBeInTheDocument();
    expect(banner().queryByRole("link", { name: "Switch group" })).toBeNull();
  });

  it("draws Switch group beside the menu button for a person with two or more groups", () => {
    act(() => rememberAssumedGroup(emea(2)));
    bar();
    const action = banner().getByRole("link", { name: "Switch group" });
    expect(action).toHaveAttribute("href", "/a/hub-1/group");
    expect(action.nextElementSibling).toBe(banner().getByRole("button", { name: "Menu" }));
  });

  it("draws no switch on a bar with a back button", () => {
    act(() => rememberAssumedGroup(emea(2)));
    bar(true);
    expect(banner().queryByRole("link", { name: "Switch group" })).toBeNull();
  });

  it("changes with the group when the group changes", () => {
    act(() => rememberAssumedGroup(emea(2)));
    bar();
    act(() => rememberAssumedGroup({ agencyId: "hub-1", id: "g2", name: "Americas", count: 2 }));
    expect(banner().getByText("Hub Steward SWE · Americas")).toBeInTheDocument();
  });

  it("ignores a group assumed in another hub", () => {
    act(() => rememberAssumedGroup(emea(2, "hub-2")));
    bar();
    expect(banner().getByText("Hub Steward SWE")).toBeInTheDocument();
    expect(banner().queryByRole("link", { name: "Switch group" })).toBeNull();
  });

  it("draws only the hub name while no group is assumed", () => {
    bar();
    expect(banner().getByText("Hub Steward SWE")).toBeInTheDocument();
    expect(banner().queryByRole("link", { name: "Switch group" })).toBeNull();
  });
});
