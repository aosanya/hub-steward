import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assumeGroup, listMyGroups, type MyGroup } from "../data/groups";
import { mountConsole, user } from "../journeys/walkSupport";

vi.mock("../data/groups", async (importOriginal) => ({ ...(await importOriginal<object>()), listMyGroups: vi.fn(), assumeGroup: vi.fn() }));

const listMock = vi.mocked(listMyGroups);
const assumeMock = vi.mocked(assumeGroup);

const farmers: MyGroup = { id: "g1", name: "Siaya farmers", roles: ["Farmer"], tags: ["siaya", "suppliers"] };
const supplier: MyGroup = { id: "g2", name: "Supplier", roles: ["Supplier"], tags: [] };
const emea: MyGroup = { id: "g3", name: "EMEA", roles: ["Practice Director", "Reviewer"] };

const answer = (groups: MyGroup[], assumedId = "") => listMock.mockResolvedValue({ groups, assumedId });

const noGroupMessage = "You are in no group yet, so you reach no rows. Ask the administrator of this hub to add you to a group.";

const status = () => screen.findByRole("heading", { level: 1, name: "Status" });
const header = () => within(screen.getByRole("banner"));
const card = (name: string) => screen.getByRole("heading", { level: 3, name }).closest(".card") as HTMLElement;
const signOutCalls = () =>
  vi.mocked(fetch).mock.calls.filter(([url, init]) => String(url).endsWith("/auth/signout") && init?.method === "POST");

beforeEach(() => {
  listMock.mockReset();
  assumeMock.mockReset();
  assumeMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a person with several groups who has assumed none", () => {
  beforeEach(() => answer([farmers, supplier]));

  it("sees one card for each group with its roles and tags, and no page of the hub", async () => {
    mountConsole();

    await screen.findByRole("heading", { level: 1, name: "Choose a group" });
    expect(within(card("Siaya farmers")).getByText("Farmer")).toBeInTheDocument();
    expect(within(card("Siaya farmers")).getByText("siaya")).toBeInTheDocument();
    expect(within(card("Siaya farmers")).getByText("suppliers")).toBeInTheDocument();
    expect(within(card("Supplier")).getByText("No tag")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Menu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Status" })).not.toBeInTheDocument();
    expect(assumeMock).not.toHaveBeenCalled();
  });

  it("assumes the group with one tap on Continue and opens the page", async () => {
    mountConsole();
    await screen.findByRole("heading", { level: 1, name: "Choose a group" });

    await user.click(within(card("Supplier")).getByRole("button", { name: "Continue" }));

    expect(assumeMock).toHaveBeenCalledTimes(1);
    expect(assumeMock).toHaveBeenCalledWith("siaya", "g2");
    await status();
    expect(header().getByRole("button", { name: /Supplier/ })).toBeInTheDocument();
  });

  it("stays on the screen and says so when the group could not be assumed", async () => {
    assumeMock.mockRejectedValue(new Error("refused"));
    mountConsole();
    await screen.findByRole("heading", { level: 1, name: "Choose a group" });

    await user.click(within(card("Supplier")).getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("The group could not be changed.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Status" })).not.toBeInTheDocument();
  });

  it("reads a choice that names a group the person no longer holds as no choice", async () => {
    answer([farmers, supplier], "gone");
    mountConsole();

    await screen.findByRole("heading", { level: 1, name: "Choose a group" });
    expect(assumeMock).not.toHaveBeenCalled();
  });
});

describe("a person with one group", () => {
  it("goes straight in with the group assumed and named in the header, and gets no switch", async () => {
    answer([emea]);
    mountConsole();

    await status();
    expect(assumeMock).toHaveBeenCalledWith("siaya", "g3");
    expect(header().getByText("EMEA")).toBeInTheDocument();
    expect(header().queryByRole("button", { name: /EMEA/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Choose a group" })).not.toBeInTheDocument();
  });

  it("makes no call to assume a group the session already holds", async () => {
    answer([emea], "g3");
    mountConsole();

    await status();
    expect(assumeMock).not.toHaveBeenCalled();
    expect(header().getByText("EMEA")).toBeInTheDocument();
  });

  it("opens no page when the group could not be assumed", async () => {
    assumeMock.mockRejectedValue(new Error("refused"));
    answer([emea]);
    mountConsole();

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Status" })).not.toBeInTheDocument();
  });
});

describe("a person with no group", () => {
  beforeEach(() => answer([]));

  it("sees a plain message that names the administrator of the hub, with sign-out and the language box only", async () => {
    mountConsole();

    expect(await screen.findByText(noGroupMessage)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /profile/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /profile/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Language" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Menu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Chat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Status" })).not.toBeInTheDocument();
  });

  it("signs out from the message", async () => {
    mountConsole();
    await screen.findByText(noGroupMessage);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(signOutCalls()).toHaveLength(1));
  });

  it("asks again on Check again and opens the hub once a group has been added", async () => {
    mountConsole();
    await screen.findByText(noGroupMessage);
    answer([emea]);

    await user.click(screen.getByRole("button", { name: "Check again" }));

    await status();
    expect(listMock).toHaveBeenCalledTimes(2);
    expect(header().getByText("EMEA")).toBeInTheDocument();
  });

  it("stays on the message when the person is still in no group", async () => {
    mountConsole();
    await screen.findByText(noGroupMessage);

    await user.click(screen.getByRole("button", { name: "Check again" }));

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText(noGroupMessage)).toBeInTheDocument();
  });
});

describe("a groups list that could not be read", () => {
  it("opens no page, says so, and reads again on Try again", async () => {
    listMock.mockRejectedValueOnce(new Error("down"));
    answer([emea], "g3");
    mountConsole();

    expect(await screen.findByText("The page could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Status" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await status();
  });
});

describe("the group control in the header of a person with several groups", () => {
  beforeEach(() => answer([farmers, supplier, emea], "g1"));

  it("names the assumed group and opens straight into the page without the screen", async () => {
    mountConsole();

    await status();
    expect(header().getByRole("button", { name: /Siaya farmers/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Choose a group" })).not.toBeInTheDocument();
  });

  it("lists the groups with the assumed one first and marked, and the roles of each", async () => {
    answer([farmers, supplier, emea], "g3");
    mountConsole();
    await status();

    await user.click(header().getByRole("button", { name: /EMEA/ }));

    const list = screen.getByText("Your groups").closest(".drop") as HTMLElement;
    const rows = within(list).getAllByRole("button");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("EMEA"),
      expect.stringContaining("Siaya farmers"),
      expect.stringContaining("Supplier"),
    ]);
    expect(rows[0]).toHaveAttribute("aria-current", "true");
    expect(rows[1]).not.toHaveAttribute("aria-current");
    expect(within(rows[0]).getByText("Practice Director · Reviewer")).toBeInTheDocument();
  });

  it("assumes another group with one tap and stays on the same page under the new group", async () => {
    mountConsole();
    await status();
    await user.click(header().getByRole("button", { name: /Siaya farmers/ }));
    const list = screen.getByText("Your groups").closest(".drop") as HTMLElement;

    await user.click(within(list).getByRole("button", { name: /Supplier/ }));

    expect(assumeMock).toHaveBeenCalledWith("siaya", "g2");
    await waitFor(() => expect(header().getByRole("button", { name: /Supplier/ })).toBeInTheDocument());
    expect(header().queryByRole("button", { name: /Siaya farmers/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Your groups")).not.toBeInTheDocument();
    await status();
  });

  it("keeps the current group and says so when the switch is refused", async () => {
    assumeMock.mockRejectedValue(new Error("refused"));
    mountConsole();
    await status();
    await user.click(header().getByRole("button", { name: /Siaya farmers/ }));
    const list = screen.getByText("Your groups").closest(".drop") as HTMLElement;

    await user.click(within(list).getByRole("button", { name: /Supplier/ }));

    expect(await screen.findByText("The group could not be changed.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Siaya farmers/ })[0]).toHaveAttribute("aria-haspopup", "true");
  });

  it("closes on Escape without changing the group", async () => {
    mountConsole();
    await status();
    await user.click(header().getByRole("button", { name: /Siaya farmers/ }));

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Your groups")).not.toBeInTheDocument();
    expect(assumeMock).not.toHaveBeenCalled();
  });
});
