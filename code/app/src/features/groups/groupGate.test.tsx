import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { forgetAssumedGroup, assumedGroupNow, rememberAssumedGroup } from "../../shared/wakala/assumedGroup";
import { forgetReads } from "../../shared/wakala/mcp";
import { signOut } from "../account/signOut";
import { provideAssumedGroupsClient } from "./assumedApi";
import { GroupGate } from "./GroupGate";
import { americas, audit, emea, fakeClient, reading } from "./groupsFixture";

vi.mock("../../shared/wakala/mcp", async (original) => ({ ...(await original<object>()), forgetReads: vi.fn() }));
vi.mock("../account/signOut", () => ({ signOut: vi.fn(async () => undefined) }));

const show = (client: ReturnType<typeof fakeClient>) => {
  provideAssumedGroupsClient(client);
  return render(
    <MemoryRouter initialEntries={["/a/hub-1/home"]}>
      <Routes>
        <Route
          path="/a/:agencyId/*"
          element={
            <GroupGate>
              <h1>Home page</h1>
            </GroupGate>
          }
        />
        <Route path="/profile" element={<h1>Profile page</h1>} />
        <Route path="/sign-in" element={<h1>Sign-in page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
};

const rowTitles = () => Array.from(document.querySelectorAll(".row .ttl")).map((title) => title.textContent);

beforeEach(() => {
  forgetAssumedGroup();
  vi.mocked(forgetReads).mockClear();
  vi.mocked(signOut).mockClear();
});

afterEach(cleanup);

describe("a person with several groups at login", () => {
  it("sees one row for each group with its roles, and no page of the hub", async () => {
    show(fakeClient(reading([emea, americas, audit])));
    expect(await screen.findByRole("heading", { name: "Choose a group" })).toBeInTheDocument();
    expect(rowTitles()).toEqual(["EMEA", "Americas", "Audit"]);
    expect(screen.getByText("Practice Director · Reviewer")).toBeInTheDocument();
    expect(screen.queryByText("Home page")).toBeNull();
  });

  it("selects nothing and has no menu and no tab bar, because nothing can be opened before a group is assumed", async () => {
    show(fakeClient(reading([emea, americas])));
    await screen.findByText("EMEA");
    expect(document.querySelector(".row[aria-pressed='true']")).toBeNull();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
  });

  it("assumes the group with one tap on its row and opens the hub", async () => {
    const client = fakeClient(reading([emea, americas]));
    show(client);
    await userEvent.click(await screen.findByText("Americas"));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(client.assume).toHaveBeenCalledTimes(1);
    expect(client.assume).toHaveBeenCalledWith("hub-1", "g2");
  });

  it("keeps the assumed group for the bar and drops what the hub read under the group before", async () => {
    show(fakeClient(reading([emea, americas])));
    await userEvent.click(await screen.findByText("Americas"));
    await screen.findByText("Home page");
    expect(assumedGroupNow()).toEqual({ agencyId: "hub-1", id: "g2", name: "Americas", count: 2 });
    expect(forgetReads).toHaveBeenCalled();
  });

  it("stays on the list and says so when the hub refuses the group", async () => {
    const client = fakeClient(reading([emea, americas]), { assume: vi.fn(async () => Promise.reject(new Error("refused"))) });
    show(client);
    await userEvent.click(await screen.findByText("Americas"));
    expect(await screen.findByText("The group was not changed. Try again.")).toBeInTheDocument();
    expect(screen.queryByText("Home page")).toBeNull();
    expect(assumedGroupNow()).toBeNull();
  });
});

describe("a person with one group", () => {
  it("skips the screen: the hub opens with the group assumed and the bar can name it", async () => {
    const client = fakeClient(reading([emea]));
    show(client);
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Choose a group" })).toBeNull();
    expect(client.assume).toHaveBeenCalledWith("hub-1", "g1");
    expect(assumedGroupNow()).toEqual({ agencyId: "hub-1", id: "g1", name: "EMEA", count: 1 });
  });
});

describe("a person whose session already has a group", () => {
  it("opens the hub with no screen and no assuming", async () => {
    const client = fakeClient(reading([emea, americas], "g2"));
    show(client);
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(client.assume).not.toHaveBeenCalled();
    expect(assumedGroupNow()).toEqual({ agencyId: "hub-1", id: "g2", name: "Americas", count: 2 });
  });

  it("is not asked again while the app holds the group of this hub", async () => {
    rememberAssumedGroup({ agencyId: "hub-1", id: "g1", name: "EMEA", count: 2 });
    const client = fakeClient(reading([emea, americas]));
    show(client);
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(client.read).not.toHaveBeenCalled();
  });

  it("asks again when the group held is the group of another hub", async () => {
    rememberAssumedGroup({ agencyId: "hub-2", id: "g1", name: "EMEA", count: 2 });
    const client = fakeClient(reading([emea, americas]));
    show(client);
    expect(await screen.findByRole("heading", { name: "Choose a group" })).toBeInTheDocument();
    expect(client.read).toHaveBeenCalledWith("hub-1");
  });
});

describe("a person with no group", () => {
  const none = () => fakeClient(reading([]));

  it("sees a plain message naming the hub administrator, and no page of the hub", async () => {
    show(none());
    expect(await screen.findByText(/Ask the hub administrator to add you to one/)).toBeInTheDocument();
    expect(screen.queryByText("Home page")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  });

  it("is offered My profile, Sign out and Check again, and nothing else", async () => {
    show(none());
    await screen.findByText(/Ask the hub administrator/);
    const names = screen.getAllByRole("button").map((button) => button.textContent);
    expect(names.sort()).toEqual(["Check again", "My profile", "Sign out"]);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("opens the profile", async () => {
    show(none());
    await userEvent.click(await screen.findByRole("button", { name: "My profile" }));
    expect(await screen.findByText("Profile page")).toBeInTheDocument();
  });

  it("signs out and goes to sign-in", async () => {
    show(none());
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });

  it("asks the hub again on Check again and opens the hub once a group was given", async () => {
    const read = vi.fn().mockResolvedValueOnce(reading([])).mockResolvedValueOnce(reading([emea]));
    show(fakeClient(reading([]), { read }));
    await userEvent.click(await screen.findByRole("button", { name: "Check again" }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("shows the message inside one card with the buttons in it", async () => {
    show(none());
    const message = await screen.findByText(/Ask the hub administrator/);
    const card = message.closest(".card") as HTMLElement;
    expect(within(card).getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });
});

describe("a hub that does not answer the groups", () => {
  it("lets the person in, because the hub decides which rows a group reaches", async () => {
    show(fakeClient(reading([]), { read: vi.fn(async () => Promise.reject(new Error("501"))) }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(assumedGroupNow()).toBeNull();
  });
});
