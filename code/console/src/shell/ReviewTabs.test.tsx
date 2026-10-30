import { render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import {
  answerWith,
  callsOf,
  english,
  hubRow,
} from "../pages/spec/profileTesting";
import { callTool, listTools } from "../wakala/mcp";
import { useOpenDetails } from "./detailsContext";
import { ChatAskCtx, ChatTellCtx } from "./chatTell";
import { ConsoleCtx } from "./context";
import { ReviewTabs } from "./ReviewTabs";

vi.mock("../wakala/mcp");

const fill = {
  page: "objectives",
  summary: "Two objectives overlap.",
  items: [
    {
      title: "Rename O-15",
      detail: "It repeats O-22.",
      tool: "agency_update_objective",
      arguments: { objective_id: "o15", title: "Sell produce" },
      then: [],
    },
    {
      title: "Merge O-17 into O-18",
      detail: "Same work.",
      tool: "agency_update_objective",
      arguments: { objective_id: "o18", title: "Buy inputs together" },
      then: [
        { tool: "agency_delete_objective", arguments: { objective_id: "o17" } },
      ],
    },
    {
      title: "Delete O-16",
      detail: "Same as O-23.",
      tool: "agency_delete_objective",
      arguments: { objective_id: "o16" },
      then: [],
    },
    {
      title: "Think about a measure",
      detail: "",
      tool: "",
      arguments: {},
      then: [],
    },
  ],
};

const withDraft = {
  type: "object",
  properties: { instance_id: { type: "string" }, draft_id: { type: "string" } },
};

const rowOf = (title: string) =>
  within(
    screen
      .getAllByText(title)
      .map((element) => element.closest("section.suggestion"))
      .find((row): row is HTMLElement => row !== null) as HTMLElement,
  );

const show = (
  review: { id: number; fill: typeof fill } | null = { id: 1, fill },
  onClose = () => {},
  ask: (text: string) => void = () => {},
  tell: (text: string) => void = () => {},
) =>
  render(
    <I18nProvider initial={english}>
      <ChatAskCtx.Provider value={ask}>
        <ChatTellCtx.Provider value={tell}>
          <ConsoleCtx.Provider
            value={{
              hub: hubRow,
              page: "objectives",
              setBadges: () => {},
              refreshMenu: () => {},
            }}
          >
            <ReviewTabs
              hubId="h1"
              page="objectives"
              review={review}
              onClose={onClose}
            >
              <p>The objectives list</p>
            </ReviewTabs>
          </ConsoleCtx.Provider>
        </ChatTellCtx.Provider>
      </ChatAskCtx.Provider>
    </I18nProvider>,
  );

beforeEach(() => {
  vi.mocked(callTool).mockReset();
  vi.mocked(listTools).mockReset();
  answerWith({
    agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
    agency_update_objective: { id: "o15" },
    agency_delete_objective: {},
  });
  vi.mocked(listTools).mockResolvedValue(
    ["agency_update_objective", "agency_delete_objective"].map((name) => ({
      name,
      description: name,
      inputSchema: withDraft,
    })),
  );
});

describe("the tabs beside a page when the chat has answered", () => {
  it("shows only the page when there is no review", () => {
    show(null);

    expect(screen.getByText("The objectives list")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Chat response" }),
    ).not.toBeInTheDocument();
  });

  it("opens on the Chat response tab, beside a tab named for the page, and goes back and forth", async () => {
    const user = userEvent.setup();
    show();

    expect(
      screen.getByRole("button", { name: "Chat response" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Two objectives overlap.")).toBeInTheDocument();
    expect(screen.getByText("The objectives list")).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "Objectives" }));
    expect(screen.getByText("The objectives list")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Chat response" }));
    expect(screen.getByText("Rename O-15")).toBeVisible();
    expect(screen.getByText("The objectives list")).not.toBeVisible();
  });

  it("closes the review", async () => {
    const onClose = vi.fn();
    show({ id: 1, fill }, onClose);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe("coming back to a review after a reload", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the rows that were dismissed and applied as they were left", async () => {
    answerWith({
      agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
      agency_update_objective: { id: "o15" },
    });
    const user = userEvent.setup();
    const first = show();
    await user.click(
      rowOf("Delete O-16").getByRole("button", { name: "Dismiss" }),
    );
    await user.click(
      rowOf("Rename O-15").getByRole("button", { name: "Apply" }),
    );
    await waitFor(() =>
      expect(
        rowOf("Rename O-15").queryByRole("button", { name: "Apply" }),
      ).not.toBeInTheDocument(),
    );
    first.unmount();

    show();

    expect(screen.queryByText("Delete O-16")).not.toBeInTheDocument();
    expect(
      rowOf("Rename O-15").queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
  });
});

describe("the order down the page", () => {
  it("puts the tabs first, then the bars that lead the page, then the page with its own header", () => {
    render(
      <I18nProvider initial={english}>
        <ConsoleCtx.Provider
          value={{
            hub: hubRow,
            page: "objectives",
            setBadges: () => {},
            refreshMenu: () => {},
          }}
        >
          <ReviewTabs
            hubId="h1"
            page="objectives"
            review={{ id: 1, fill }}
            onClose={() => {}}
            lead={<p>The draft bar</p>}
          >
            <h1>The page header</h1>
          </ReviewTabs>
        </ConsoleCtx.Provider>
      </I18nProvider>,
    );
    screen.getByRole("button", { name: "Objectives" }).click();

    const tabs = screen
      .getByRole("button", { name: "Chat response" })
      .closest("nav") as HTMLElement;
    return waitFor(() => {
      const heading = screen.getByText("The page header");
      expect(
        tabs.compareDocumentPosition(screen.getByText("The draft bar")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        tabs.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });
});

describe("the first tab", () => {
  const withTab = (pageTab: string) =>
    render(
      <I18nProvider initial={english}>
        <ConsoleCtx.Provider
          value={{
            hub: hubRow,
            page: "objectives",
            setBadges: () => {},
            refreshMenu: () => {},
          }}
        >
          <ReviewTabs
            hubId="h1"
            page="objectives"
            pageTab={pageTab}
            review={{ id: 1, fill }}
            onClose={() => {}}
          >
            <p>The page</p>
          </ReviewTabs>
        </ConsoleCtx.Provider>
      </I18nProvider>,
    );

  it("is named for the page, and for the single item when one is open", () => {
    const list = withTab("objectives");
    expect(
      screen.getByRole("button", { name: "Objectives" }),
    ).toBeInTheDocument();
    list.unmount();

    withTab("objective");
    expect(
      screen.getByRole("button", { name: "Objective" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Objectives" }),
    ).not.toBeInTheDocument();
  });
});

describe("navigating to another page", () => {
  const tree = (page: string) => (
    <I18nProvider initial={english}>
      <ConsoleCtx.Provider
        value={{
          hub: hubRow,
          page,
          setBadges: () => {},
          refreshMenu: () => {},
        }}
      >
        <ReviewTabs
          hubId="h1"
          page={page}
          review={{ id: 1, fill }}
          onClose={() => {}}
        >
          <p>The {page} page</p>
        </ReviewTabs>
      </ConsoleCtx.Provider>
    </I18nProvider>
  );

  it("keeps the Chat response tab, with what was dismissed, and shows the new page", async () => {
    const user = userEvent.setup();
    const { rerender } = render(tree("objectives"));
    await user.click(
      rowOf("Rename O-15").getByRole("button", { name: "Dismiss" }),
    );

    rerender(tree("roles"));

    expect(screen.getByText("The roles page")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Chat response" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Chat response" }));
    expect(screen.queryByText("Rename O-15")).not.toBeInTheDocument();
    expect(screen.getByText("Delete O-16")).toBeVisible();
  });
});

describe("telling the chat what was applied", () => {
  it("logs an Applied message in the chat thread once the change is made", async () => {
    answerWith({
      agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
      agency_update_objective: { id: "o15" },
    });
    const tell = vi.fn();
    const user = userEvent.setup();
    show(
      { id: 1, fill },
      () => {},
      () => {},
      tell,
    );

    await user.click(
      rowOf("Rename O-15").getByRole("button", { name: "Apply" }),
    );

    await waitFor(() =>
      expect(tell).toHaveBeenCalledWith("Applied: Rename O-15"),
    );
  });

  it("logs nothing when the change is refused", async () => {
    answerWith({
      agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
      agency_update_objective: () => {
        throw new Error("name already used");
      },
    });
    const tell = vi.fn();
    const user = userEvent.setup();
    show(
      { id: 1, fill },
      () => {},
      () => {},
      tell,
    );

    await user.click(
      rowOf("Rename O-15").getByRole("button", { name: "Apply" }),
    );

    expect(await screen.findByText("name already used")).toBeInTheDocument();
    expect(tell).not.toHaveBeenCalled();
  });
});

describe("a review kept from before suggestions could take more than one change", () => {
  it("still applies a row that has no list of further changes", async () => {
    answerWith({
      agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
      agency_update_objective: { id: "o15" },
    });
    const kept = {
      title: "Rename O-15",
      detail: "",
      tool: "agency_update_objective",
      arguments: { objective_id: "o15" },
    };
    show({
      id: 1,
      fill: { ...fill, items: [kept as (typeof fill.items)[number]] },
    });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(
        rowOf("Rename O-15").queryByRole("button", { name: "Apply" }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("a suggestion that takes more than one change", () => {
  it("updates the kept item and then deletes the duplicate, both in the working draft", async () => {
    vi.mocked(callTool).mockImplementation(
      async (_hub: string, name: string) =>
        name === "agency_list_drafts"
          ? { items: [{ id: "d1", status: "open" }] }
          : {},
    );
    const user = userEvent.setup();
    show();

    await user.click(
      rowOf("Merge O-17 into O-18").getByRole("button", { name: "Apply" }),
    );

    await waitFor(() =>
      expect(
        rowOf("Merge O-17 into O-18").queryByRole("button", { name: "Apply" }),
      ).not.toBeInTheDocument(),
    );
    const changes = vi
      .mocked(callTool)
      .mock.calls.filter(
        (call) =>
          call[1].startsWith("agency_update_") ||
          call[1].startsWith("agency_delete_"),
      );
    expect(changes.map((call) => [call[1], call[2]])).toEqual([
      [
        "agency_update_objective",
        {
          objective_id: "o18",
          title: "Buy inputs together",
          draft_id: "d1",
          instance_id: "h1",
        },
      ],
      [
        "agency_delete_objective",
        { objective_id: "o17", draft_id: "d1", instance_id: "h1" },
      ],
    ]);
  });
});

describe("asking about a suggestion", () => {
  it("sends the typed question to the normal chat, with the suggestion it is about, and empties the box", async () => {
    const ask = vi.fn();
    const user = userEvent.setup();
    show({ id: 1, fill }, () => {}, ask);

    await user.click(
      within(
        screen
          .getByText("Rename O-15")
          .closest("section.suggestion") as HTMLElement,
      ).getByText("Ask the chat about this", { selector: "button" }),
    );
    const box = within(
      screen
        .getByText("Rename O-15")
        .closest("section.suggestion") as HTMLElement,
    ).getByRole("textbox", { name: "Ask the chat about this" });
    await user.type(box, "Which goal fits better?");
    await user.click(
      within(
        screen
          .getByText("Rename O-15")
          .closest("section.suggestion") as HTMLElement,
      ).getByRole("button", { name: "Send" }),
    );

    await waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    expect(ask).toHaveBeenCalledWith(
      'About your suggestion "Rename O-15" (It repeats O-22.): Which goal fits better?',
      expect.stringContaining("Title: Rename O-15"),
    );
    expect(box).toHaveValue("");
  });

  it("does not send an empty question", async () => {
    show();

    await userEvent
      .setup()
      .click(
        rowOf("Rename O-15").getByRole("button", {
          name: "Ask the chat about this",
        }),
      );
    expect(
      rowOf("Rename O-15").getByRole("button", { name: "Send" }),
    ).toBeDisabled();
  });
});

describe("the details of a suggestion", () => {
  const goals = [
    {
      id: "g18",
      code: "G-18",
      title: "Market Linkages",
      description: "Link farmers to markets.",
    },
  ];
  const objectives = [
    {
      id: "o15",
      code: "O-15",
      title: "Sell produce",
      description: "Sell what is grown.",
      goal_id: "g14",
    },
    {
      id: "o22",
      code: "O-22",
      title: "Link Farmers to Buyers",
      description: "Buyers meet farmers.",
      goal_id: "g18",
    },
  ];

  beforeEach(() => {
    answerWith({
      agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
      agency_list_goals: { items: goals },
      agency_list_objectives: { items: objectives },
      agency_list_roles: { items: [] },
      agency_update_objective: { id: "o15" },
    });
  });

  it("opens a Details tab that explains each code the suggestion mentions, and the item it changes", async () => {
    const user = userEvent.setup();
    show();

    await user.click(
      rowOf("Rename O-15").getByRole("button", { name: "Details" }),
    );

    expect(screen.getByRole("combobox", { name: "Details" })).toHaveValue(
      "Rename O-15",
    );
    expect(await screen.findByText("Buyers meet farmers.")).toBeInTheDocument();
    expect(screen.getByText("Sell what is grown.")).toBeInTheDocument();
  });

  it("lists every opened Details in a dropdown at the end of the tabs and shows the one picked", async () => {
    const user = userEvent.setup();
    show();
    await user.click(
      rowOf("Rename O-15").getByRole("button", { name: "Details" }),
    );
    await user.click(screen.getByRole("button", { name: "Chat response" }));
    await user.click(
      rowOf("Merge O-17 into O-18").getByRole("button", { name: "Details" }),
    );

    const menu = screen.getByRole("combobox", { name: "Details" });
    expect(
      within(menu)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Details", "Rename O-15", "Merge O-17 into O-18"]);
    await user.selectOptions(menu, "Rename O-15");
    expect(menu).toHaveValue("Rename O-15");
  });

  it("keeps what was applied on the Chat response tab while the details are open", async () => {
    const user = userEvent.setup();
    show();
    await user.click(
      rowOf("Rename O-15").getByRole("button", { name: "Apply" }),
    );
    await waitFor(() =>
      expect(
        rowOf("Rename O-15").queryByRole("button", { name: "Apply" }),
      ).not.toBeInTheDocument(),
    );

    await user.click(
      rowOf("Rename O-15").getByRole("button", { name: "Details" }),
    );
    await user.click(screen.getByRole("button", { name: "Chat response" }));

    expect(
      rowOf("Rename O-15").queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
  });

  it("says so when nothing is known about what the suggestion names", async () => {
    show({
      id: 1,
      fill: {
        ...fill,
        items: [
          {
            title: "Think about a measure",
            detail: "",
            tool: "",
            arguments: {},
            then: [],
          },
        ],
      },
    });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Details" }));

    expect(
      await screen.findByText("Nothing more is known about what this names."),
    ).toBeInTheDocument();
  });
});

describe("the suggestions in the Chat response tab", () => {
  it("has Apply and Dismiss on a row with a change, and only Dismiss on plain advice", () => {
    show();

    expect(
      rowOf("Rename O-15").getByRole("button", { name: "Apply" }),
    ).toBeInTheDocument();
    expect(
      rowOf("Think about a measure").queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
    expect(
      rowOf("Think about a measure").getByRole("button", { name: "Dismiss" }),
    ).toBeInTheDocument();
  });

  it("makes the change in the working draft when Apply is pressed and takes the Apply button off the row", async () => {
    show();

    await userEvent
      .setup()
      .click(rowOf("Rename O-15").getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(
        rowOf("Rename O-15").queryByRole("button", { name: "Apply" }),
      ).not.toBeInTheDocument(),
    );
    expect(callsOf("agency_update_objective")).toEqual([
      {
        objective_id: "o15",
        title: "Sell produce",
        draft_id: "d1",
        instance_id: "h1",
      },
    ]);
    expect(callsOf("agency_delete_objective")).toEqual([]);
  });

  it("removes a dismissed row without calling anything", async () => {
    show();

    await userEvent
      .setup()
      .click(rowOf("Delete O-16").getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Delete O-16")).not.toBeInTheDocument();
    expect(callsOf("agency_delete_objective")).toEqual([]);
  });

  it("applies every row that has a change when Apply all is pressed", async () => {
    show();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Apply all" }));

    await waitFor(() =>
      expect(callsOf("agency_delete_objective")).toHaveLength(2),
    );
    expect(callsOf("agency_update_objective")).toHaveLength(2);
  });

  it("shows why a change failed on its row and lets it be tried again", async () => {
    answerWith({
      agency_list_drafts: { items: [{ id: "d1", status: "open" }] },
      agency_update_objective: () => {
        throw new Error("name already used");
      },
    });
    show();

    await userEvent
      .setup()
      .click(rowOf("Rename O-15").getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("name already used")).toBeInTheDocument();
    expect(
      rowOf("Rename O-15").getByRole("button", { name: "Apply" }),
    ).toBeEnabled();
  });

  it("will not apply a tool the page does not allow a suggestion to carry", async () => {
    show({
      id: 1,
      fill: {
        ...fill,
        page: "objectives",
        items: [
          {
            title: "Remove a role",
            detail: "",
            tool: "agency_delete_role",
            arguments: {},
            then: [],
          },
        ],
      },
    });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Apply" }));

    expect(
      await screen.findByText("this suggestion has no change to apply"),
    ).toBeInTheDocument();
  });
});

describe("details opened from a page with no Chat response", () => {
  function Opener() {
    const open = useOpenDetails();
    return (
      <button
        type="button"
        onClick={() =>
          open({
            title: "Make G-14 clear",
            detail: "No description.",
            tool: "",
            arguments: {},
            then: [],
          })
        }
      >
        open it
      </button>
    );
  }

  it("shows a Details tab next to the page tab, and goes back to the page from the page tab", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider initial={english}>
        <ConsoleCtx.Provider
          value={{
            hub: hubRow,
            page: "objectives",
            setBadges: () => {},
            refreshMenu: () => {},
          }}
        >
          <ReviewTabs
            hubId="h1"
            page="objectives"
            review={null}
            onClose={() => {}}
          >
            <Opener />
          </ReviewTabs>
        </ConsoleCtx.Provider>
      </I18nProvider>,
    );
    expect(screen.queryByRole("combobox", { name: "Details" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "open it" }));

    expect(screen.getByRole("combobox", { name: "Details" })).toHaveValue(
      "Make G-14 clear",
    );
    expect(screen.queryByRole("button", { name: "open it" })).toBeNull();

    await user.click(
      screen
        .getAllByRole("button")
        .find((el) => el.classList.contains("tab")) as HTMLElement,
    );
    expect(screen.getByRole("button", { name: "open it" })).toBeInTheDocument();
  });

  it("keeps the page mounted while its Details tab is shown, so coming back does not load it again", async () => {
    const user = userEvent.setup();
    let mounts = 0;
    function Counted() {
      useEffect(() => {
        mounts += 1;
      }, []);
      const open = useOpenDetails();
      return (
        <button
          type="button"
          onClick={() =>
            open({
              title: "Make G-14 clear",
              detail: "",
              tool: "",
              arguments: {},
              then: [],
            })
          }
        >
          open it
        </button>
      );
    }
    render(
      <I18nProvider initial={english}>
        <ConsoleCtx.Provider
          value={{
            hub: hubRow,
            page: "objectives",
            setBadges: () => {},
            refreshMenu: () => {},
          }}
        >
          <ReviewTabs
            hubId="h1"
            page="objectives"
            review={null}
            onClose={() => {}}
          >
            <Counted />
          </ReviewTabs>
        </ConsoleCtx.Provider>
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "open it" }));
    expect(
      screen.getByRole("button", { name: "open it", hidden: true }),
    ).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Objectives" }));

    expect(screen.getByRole("button", { name: "open it" })).toBeVisible();
    expect(mounts).toBe(1);
  });
});
