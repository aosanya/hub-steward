import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../../i18n";
import {
  MsgAction,
  MsgAssistant,
  MsgChoice,
  MsgConfirm,
  MsgEdit,
  MsgError,
  MsgForm,
  MsgList,
  MsgNav,
  MsgResult,
  MsgRows,
  MsgSuggestion,
  MsgTool,
  MsgTools,
  MsgUser,
  formatMs,
} from ".";

const words = {
  en: {
    approve: "Approve",
    cancel: "Cancel",
    "ui.suggestedNextStep": "Suggested next step",
    "ui.nothingRecorded": "Nothing is recorded until you approve.",
    "ui.confirmed": "Confirmed",
    "ui.cancelledNothing": "Cancelled. Nothing was recorded.",
    "ui.shownInContent": "Shown in the content area",
    "ui.toolCalledOne": "Called 1 tool",
    "ui.toolsCalled": "Called {n} tools",
    "ui.resultOne": "{n} result",
    "ui.resultMany": "{n} results",
    "ui.rowOne": "{n} row",
    "ui.rowMany": "{n} rows",
    "ui.itemOne": "{n} item",
    "ui.itemMany": "{n} items",
    "ui.form": "Form",
    "ui.opened": "Opened {label}",
  },
};

const show = (ui: ReactElement) =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </I18nProvider>,
  );

describe("the two sides of the thread", () => {
  it("shows what the person wrote in a bubble on the right", () => {
    const { container } = show(<MsgUser>What is still missing?</MsgUser>);
    expect(container.querySelector(".msg.user > .bubble")).toHaveTextContent("What is still missing?");
  });

  it("shows what the assistant wrote beside its badge", () => {
    const { container } = show(<MsgAssistant>One step is left.</MsgAssistant>);
    expect(container.querySelector(".msg.bot > .bot-badge svg")).toBeInTheDocument();
    expect(container.querySelector(".msg.bot > .bot-text")).toHaveTextContent("One step is left.");
  });
});

describe("the time a tool call took", () => {
  it("writes under a second in milliseconds and the rest in seconds", () => {
    expect(formatMs(188)).toBe("188 ms");
    expect(formatMs(999)).toBe("999 ms");
    expect(formatMs(1000)).toBe("1.0 s");
    expect(formatMs(1234)).toBe("1.2 s");
    expect(formatMs(undefined)).toBe("");
  });
});

describe("MsgTool", () => {
  it("shows the name, what came back and how long it took", () => {
    const { container } = show(<MsgTool name="ai_list_models" summary="1 model" ms={119} />);
    expect(container.querySelector(".tool")).not.toHaveClass("error");
    expect(screen.getByText("ai_list_models")).toHaveClass("tool-name");
    expect(screen.getByText("1 model")).toHaveClass("tool-sum");
    expect(screen.getByText("119 ms")).toHaveClass("tool-ms");
    expect(container.querySelector(".tool-state svg")).toBeInTheDocument();
  });

  it("shows a spinner while the call runs and no time yet", () => {
    const { container } = show(<MsgTool name="ai_list_models" summary="Waiting" state="running" />);
    expect(container.querySelector(".tool-state .tool-spin")).toBeInTheDocument();
    expect(container.querySelector(".tool-ms")).toBeEmptyDOMElement();
  });

  it("shows a failed call in the error look", () => {
    const { container } = show(<MsgTool name="ai_list_models" summary="Not reachable" state="error" ms={40} />);
    expect(container.querySelector(".tool")).toHaveClass("error");
  });
});

describe("MsgTools", () => {
  const calls = [
    { name: "agency_get_agency", summary: "Siaya Farmers' Group", ms: 188 },
    { name: "ai_list_models", summary: "1 model", ms: 119 },
  ];

  it("starts collapsed with the number of calls and the time they took together", () => {
    const { container } = show(<MsgTools calls={calls} />);
    expect(container.querySelector(".tools")).toHaveClass("collapsed");
    expect(screen.getByRole("button", { name: /Called 2 tools/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("307 ms")).toHaveClass("muted");
    expect(screen.queryByText("agency_get_agency")).not.toBeInTheDocument();
  });

  it("opens to each call with its milliseconds and closes again", async () => {
    const { container } = show(<MsgTools calls={calls} />);
    await userEvent.click(screen.getByRole("button", { name: /Called 2 tools/ }));
    expect(container.querySelector(".tools")).not.toHaveClass("collapsed");
    expect(screen.getByText("agency_get_agency")).toBeInTheDocument();
    expect(screen.getByText("188 ms")).toBeInTheDocument();
    expect(screen.getByText("119 ms")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Called 2 tools/ }));
    expect(screen.queryByText("agency_get_agency")).not.toBeInTheDocument();
  });

  it("can start open", () => {
    show(<MsgTools calls={calls} expanded />);
    expect(screen.getByText("ai_list_models")).toBeInTheDocument();
  });

  it("says one tool in the singular and leaves out the time when no call has one", () => {
    show(<MsgTools calls={[{ name: "ai_list_models", summary: "1 model" }]} />);
    expect(screen.getByRole("button", { name: "Called 1 tool" })).toBeInTheDocument();
  });

  it("uses the title it is given", () => {
    show(<MsgTools calls={calls} title="Looked things up" />);
    expect(screen.getByRole("button", { name: /Looked things up/ })).toBeInTheDocument();
  });
});

describe("MsgChoice", () => {
  it("offers each option and reports the one picked", async () => {
    const onPick = vi.fn();
    show(<MsgChoice question="Which provider?" options={["Hugging Face", "Claude"]} onPick={onPick} />);
    expect(screen.getByRole("heading", { name: "Which provider?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Claude" }));
    expect(onPick).toHaveBeenCalledWith("Claude");
  });

  it("shows the option picked as filled and switches the others off", () => {
    show(<MsgChoice question="Which provider?" options={["Hugging Face", "Claude"]} picked="Claude" />);
    expect(screen.getByRole("button", { name: "Claude" })).toHaveClass("primary");
    expect(screen.getByRole("button", { name: "Hugging Face" })).toBeDisabled();
  });
});

describe("MsgConfirm", () => {
  it("asks with Approve and Cancel and says nothing is recorded yet", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    show(<MsgConfirm title="Rename the hub?" detail="It keeps its people." onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText("It keeps its people.")).toHaveClass("msg-detail");
    expect(screen.getByText("Nothing is recorded until you approve.")).toHaveClass("msg-note");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses the labels it is given and the danger look for a risky change", () => {
    show(<MsgConfirm title="Delete the Riders group?" detail="Its users stay." confirm="Delete" cancel="Keep" danger />);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("danger");
    expect(screen.getByRole("button", { name: "Keep" })).toHaveClass("quiet");
  });

  it("shows only the word Confirmed once it is confirmed", () => {
    show(<MsgConfirm title="Rename?" detail="Done." resolved="confirmed" />);
    expect(screen.getByText("Confirmed").closest(".msg-done")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows only that nothing was recorded once it is cancelled", () => {
    show(<MsgConfirm title="Rename?" detail="Done." resolved="cancelled" />);
    expect(screen.getByText("Cancelled. Nothing was recorded.")).toHaveClass("msg-note");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("MsgError", () => {
  it("shows the sentence in a card with the error look", () => {
    const { container } = show(<MsgError>The model could not be reached.</MsgError>);
    expect(container.querySelector(".msg-card.bad .msg-title.bad")).toHaveTextContent("The model could not be reached.");
  });
});

describe("MsgSuggestion", () => {
  it("shows the suggestion under its heading with a button to the place", () => {
    show(<MsgSuggestion text="Add a second model for riders." actions={[{ label: "Add a model", to: "/h/x/models" }]} />);
    expect(screen.getByRole("heading", { name: "Suggested next step" })).toBeInTheDocument();
    expect(screen.getByText("Add a second model for riders.")).toHaveClass("msg-detail");
    expect(screen.getByRole("link", { name: "Add a model" })).toHaveAttribute("href", "/h/x/models");
  });
});

describe("MsgAction", () => {
  it("shows the title, the detail and the buttons, a link for a place and a button for a step", async () => {
    const onClick = vi.fn();
    show(
      <MsgAction
        title="Add a model key"
        detail="The agent will not reply until a key is saved."
        buttons={[
          { label: "Add a model", kind: "primary", to: "/h/x/models" },
          { label: "Later", onClick },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Add a model key" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Add a model" });
    expect(link).toHaveClass("btn", "primary", "sm");
    expect(link.querySelector("svg")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Nothing is recorded until you approve.")).not.toBeInTheDocument();
  });

  it("says nothing is recorded yet while it is pending", () => {
    show(<MsgAction title="Move the Dispatcher" state="pending" buttons={[{ label: "Approve", kind: "primary" }]} />);
    expect(screen.getByText("Nothing is recorded until you approve.")).toBeInTheDocument();
  });

  it("shows a tick in the ok colour once it is done", () => {
    const { container } = show(<MsgAction title="Dispatcher moved" detail="It now uses Sonnet." state="done" />);
    expect(container.querySelector(".msg-title")).toHaveClass("ok");
    expect(screen.queryByText("Nothing is recorded until you approve.")).not.toBeInTheDocument();
  });
});

describe("the cards that point at the content area", () => {
  it("counts the results of a list and says where to look", () => {
    const { container } = show(<MsgList title="3 roles use Hugging Face" count={3} />);
    expect(container.querySelector(".msg-card.msg-ref")).toBeInTheDocument();
    expect(screen.getByText("3 results")).toHaveClass("tag", "mute");
    expect(screen.getByText("Shown in the content area")).toHaveClass("msg-note", "ref-go");
  });

  it("says one result in the singular", () => {
    show(<MsgList title="1 role" count={1} />);
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("adds the button to the place the list lives in", () => {
    show(<MsgList title="3 roles" count={3} nav={{ label: "Open Agents", to: "/h/x/agents" }} />);
    expect(screen.getByRole("link", { name: "Open Agents" })).toHaveAttribute("href", "/h/x/agents");
  });

  it("counts rows and items and names a form", () => {
    show(
      <>
        <MsgRows title="New goals" count={2} />
        <MsgResult title="Group added" count={1} />
        <MsgEdit title="Edit the profile" />
        <MsgForm title="Connect Claude" />
      </>,
    );
    expect(screen.getByText("2 rows")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.getAllByText("Form")).toHaveLength(2);
  });
});

describe("MsgNav", () => {
  it("says which page the chat opened and links to it", () => {
    show(<MsgNav label="Agents" to="/h/x/agents" icon="robot" />);
    const link = screen.getByRole("link", { name: "Opened Agents" });
    expect(link).toHaveClass("nav-div");
    expect(link).toHaveAttribute("href", "/h/x/agents");
    expect(within(link).getByText("Opened Agents").closest("span")?.querySelectorAll("svg")).toHaveLength(2);
  });
});
