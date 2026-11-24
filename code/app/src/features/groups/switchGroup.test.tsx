import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetAssumedGroup, assumedGroupNow, rememberAssumedGroup } from "../../shared/wakala/assumedGroup";
import { forgetReads } from "../../shared/wakala/mcp";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { provideAssumedGroupsClient } from "./assumedApi";
import { americas, audit, emea, fakeClient, reading } from "./groupsFixture";
import { groupsPaths } from "./routePaths";
import { SwitchGroupPage } from "./SwitchGroupPage";

vi.mock("../../shared/wakala/mcp", async (original) => ({ ...(await original<object>()), forgetReads: vi.fn() }));

const show = (client: ReturnType<typeof fakeClient>) => {
  provideAssumedGroupsClient(client);
  return render(
    <MemoryRouter initialEntries={["/a/hub-1/home", "/a/hub-1/group"]} initialIndex={1}>
      <Routes>
        <Route path={groupsPaths.switchGroup.pattern} element={<SwitchGroupPage />} />
        <Route path="/a/hub-1/home" element={<h1>Home page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
};

const rowTitles = () => Array.from(document.querySelectorAll(".row .ttl")).map((title) => title.textContent);

beforeEach(() => {
  openAgency("hub-1");
  rememberAssumedGroup({ agencyId: "hub-1", id: "g1", name: "EMEA", count: 3 });
  vi.mocked(forgetReads).mockClear();
});

afterEach(() => {
  cleanup();
  forgetAssumedGroup();
  forgetOpenAgency();
});

describe("Switch group", () => {
  it("has its path under the hub", () => {
    expect(groupsPaths.switchGroup.path()).toBe("/a/hub-1/group");
    expect(groupsPaths.switchGroup.retired).toBe("/group");
  });

  it("lists the groups again with the assumed group first and marked Current", async () => {
    show(fakeClient(reading([americas, emea, audit], "g1")));
    await screen.findByText("Americas");
    expect(rowTitles()).toEqual(["EMEA", "Americas", "Audit"]);
    const current = screen.getByText("Current");
    expect(current.closest(".row")).toHaveTextContent("EMEA");
    expect(screen.getAllByText("Current")).toHaveLength(1);
    expect(current.closest(".row")).toHaveAttribute("aria-pressed", "true");
  });

  it("is titled Switch group with a back button and no tab bar", async () => {
    show(fakeClient(reading([emea, americas], "g1")));
    await screen.findByText("Americas");
    expect(screen.getByRole("heading", { name: "Switch group" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Home/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  });

  it("assumes another group with one tap and returns to the page the person was on", async () => {
    const client = fakeClient(reading([emea, americas], "g1"));
    show(client);
    await userEvent.click(await screen.findByText("Americas"));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(client.assume).toHaveBeenCalledWith("hub-1", "g2");
    expect(assumedGroupNow()).toEqual({ agencyId: "hub-1", id: "g2", name: "Americas", count: 2 });
    expect(forgetReads).toHaveBeenCalled();
  });

  it("returns without assuming again when the current group is tapped", async () => {
    const client = fakeClient(reading([emea, americas], "g1"));
    show(client);
    await userEvent.click(await screen.findByText("EMEA"));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(client.assume).not.toHaveBeenCalled();
  });

  it("stays on the list and says so when the hub refuses the group", async () => {
    const client = fakeClient(reading([emea, americas], "g1"), { assume: vi.fn(async () => Promise.reject(new Error("refused"))) });
    show(client);
    await userEvent.click(await screen.findByText("Americas"));
    expect(await screen.findByText("The group was not changed. Try again.")).toBeInTheDocument();
    expect(assumedGroupNow()?.id).toBe("g1");
  });

  it("says when the groups could not be loaded", async () => {
    show(fakeClient(reading([]), { read: vi.fn(async () => Promise.reject(new Error("down"))) }));
    expect(await screen.findByText("Your groups did not load. Check your connection and try again.")).toBeInTheDocument();
  });
});
