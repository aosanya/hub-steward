import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../i18n";
import type { FieldSpec } from "../types";
import {
  AddTile,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  Cell,
  Chip,
  DataTable,
  Detail,
  Empty,
  Field,
  FilterBar,
  FilterChip,
  FormObject,
  Glyph,
  Grid,
  Note,
  Notice,
  NoticeCtx,
  Progress,
  Row,
  SearchField,
  SectionTitle,
  SelectControl,
  SelectField,
  SettingRows,
  Stack,
  Stats,
  StatusLine,
  Tabs,
  TextControl,
  TextLink,
  TextareaControl,
  ThemePicker,
  Tile,
  Timeline,
  TitleRow,
  Toggle,
  Toolbar,
  TwoCol,
  initials,
} from ".";

const words = {
  en: {
    required: "Required",
    pendingApproval: "This change waits for approval before it takes effect.",
    waitingForApproval: "Waiting for approval",
    submit: "Submit",
    cancel: "Cancel",
    copy: "Copy",
    modelKeySet: "set",
    "models.showKey": "Show key",
    "models.hideKey": "Hide key",
    "models.paste": "Paste your key",
    "notice.dismiss": "Dismiss",
    "ui.on": "On",
    "ui.off": "Off",
    "ui.noFile": "No file attached",
    "ui.choose": "Choose",
    "ui.removeFilter": "Remove filter: {filter}",
    "ui.theme": "Theme",
    "ui.theme.dark": "Dark",
    "ui.theme.light": "Light",
    "field.name": "Name",
    "field.key": "Key",
  },
};

const show = (ui: ReactElement) =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </I18nProvider>,
  );

const variable = (element: HTMLElement | null, name: string) => element?.style.getPropertyValue(name);

describe("Button", () => {
  it("shows a danger button with the danger look", () => {
    show(<Button kind="danger">Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("btn", "danger");
  });

  it("gives the primary button its own class so the accent colour can reach it", () => {
    show(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("btn", "primary");
  });

  it("shows the small and the extra small size and a button that fills its row", () => {
    show(
      <>
        <Button size="sm">Small</Button>
        <Button size="xs">Tiny</Button>
        <Button wide>Wide</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("sm");
    expect(screen.getByRole("button", { name: "Tiny" })).toHaveClass("xs");
    expect(screen.getByRole("button", { name: "Wide" })).toHaveClass("act");
  });

  it("keeps the class names the page adds", () => {
    show(<Button className="extra">Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("btn", "primary", "extra");
  });

  it("puts a plain icon before the label and an arrow after it", () => {
    show(
      <>
        <Button icon="plus">Add</Button>
        <Button icon="arrow">Next</Button>
      </>,
    );
    const add = screen.getByRole("button", { name: "Add" });
    const next = screen.getByRole("button", { name: "Next" });
    expect(add.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(add.lastChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(next.lastElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(next.firstChild?.nodeType).toBe(Node.TEXT_NODE);
  });
});

describe("ButtonLink", () => {
  it("links to its place with the button look and a trailing arrow", () => {
    show(
      <ButtonLink to="/h/x/models" kind="quiet" size="sm" icon="arrow">
        Open models
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Open models" });
    expect(link).toHaveAttribute("href", "/h/x/models");
    expect(link).toHaveClass("btn", "quiet", "sm");
    expect(link.lastElementChild?.tagName.toLowerCase()).toBe("svg");
  });
});

describe("TextLink", () => {
  it("links to its place with an arrow when asked", () => {
    show(
      <TextLink to="/h/x/users" arrow size="sm">
        Open
      </TextLink>,
    );
    const link = screen.getByRole("link", { name: "Open" });
    expect(link).toHaveClass("link", "sm");
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("acts as a button that calls its handler when it has no place to go", async () => {
    const onClick = vi.fn();
    show(<TextLink onClick={onClick}>Retry</TextLink>);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("TitleRow", () => {
  it("lays the heading and the page's controls out in the top bar", () => {
    const { container } = show(<TitleRow title="Models" primary="Add" />);
    expect(container.querySelector(".top > h1")).toHaveTextContent("Models");
    expect(container.querySelector(".top > .top-end")).toContainElement(screen.getByRole("button", { name: "Add" }));
  });

  it("shows the extra actions before the primary button", () => {
    show(<TitleRow title="Models" primary="Add a model" actions={<Button kind="quiet">Export</Button>} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Export", "Add a model"]);
  });

  it("makes the primary button a link when it has a place to go", () => {
    show(<TitleRow title="Models" primary="Add a model" primaryTo="/h/x/models/add" />);
    expect(screen.getByRole("link", { name: "Add a model" })).toHaveAttribute("href", "/h/x/models/add");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Notice", () => {
  it("tells a success in a status line with a check, the text and a dismiss button", () => {
    const { container } = show(<Notice text="Claude Sonnet 5.5 was added successfully." onDismiss={() => {}} />);
    const bar = screen.getByRole("status");
    expect(bar).toHaveClass("notice", "ok");
    expect(bar).toHaveTextContent("Claude Sonnet 5.5 was added successfully.");
    expect(container.querySelectorAll(".notice > svg")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("tells a failure in an alert", () => {
    show(<Notice kind="bad" text="Could not be added." onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toHaveClass("notice", "bad");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("calls its handler when the dismiss button is pressed", async () => {
    const onDismiss = vi.fn();
    show(<Notice text="Added." onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("TitleRow with a notice", () => {
  const held = { message: { id: 1, text: "Added.", kind: "ok" as const }, show: () => {}, dismiss: () => {} };

  it("shows the held message directly under the top bar", () => {
    const { container } = show(
      <NoticeCtx.Provider value={held}>
        <TitleRow title="Models" />
      </NoticeCtx.Provider>,
    );
    expect(container.querySelector(".top + .notice")).toHaveTextContent("Added.");
  });

  it("shows nothing under the top bar when no message is held", () => {
    const { container } = show(<TitleRow title="Models" />);
    expect(container.querySelector(".notice")).toBeNull();
  });

  it("dismisses the held message through the context", async () => {
    const dismiss = vi.fn();
    show(
      <NoticeCtx.Provider value={{ ...held, dismiss }}>
        <TitleRow title="Models" />
      </NoticeCtx.Provider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe("Stats", () => {
  it("shows the line under a figure only when there is one", () => {
    show(<Stats items={[{ label: "Open", value: 4, sub: "today" }, { label: "Late", value: 1 }]} />);
    expect(screen.getByText("today")).toHaveClass("stat-sub");
    expect(document.querySelectorAll(".stat-sub")).toHaveLength(1);
  });

  it("lays the figures out in a grid with narrow cells", () => {
    const { container } = show(<Stats items={[{ label: "Open", value: 4 }]} />);
    const grid = container.querySelector<HTMLElement>(".grid");
    expect(variable(grid, "--grid-min")).toBe("11rem");
    expect(variable(grid, "--grid-gap")).toBe("12px");
  });
});

describe("Tile", () => {
  it("shows a tick on a tile that is fine and no arrow when it goes nowhere", () => {
    const { container } = show(<Tile label="Hub manager" value="You" />);
    expect(container.querySelector(".tile")).not.toHaveClass("warn", "bad", "mute");
    expect(screen.getByText("Hub manager")).toHaveClass("tile-label");
    expect(screen.getByText("You")).toHaveClass("tile-value");
    expect(container.querySelector(".tile-arrow")).toBeNull();
  });

  it("marks a tile that needs attention and links it to its place", () => {
    show(<Tile label="Model key" value="Needed to reply" state="warn" to="/h/x/models" />);
    const tile = screen.getByRole("link");
    expect(tile).toHaveClass("tile", "warn");
    expect(tile).toHaveAttribute("href", "/h/x/models");
    expect(tile.querySelector(".tile-arrow")).toBeInTheDocument();
  });

  it.each(["bad", "mute"] as const)("gives a %s tile its own look", (state) => {
    const { container } = show(<Tile label="Alert" value="Link down" state={state} />);
    expect(container.querySelector(".tile")).toHaveClass(state);
  });
});

describe("Progress", () => {
  it("fills the bar to the percentage and says how far along it is", () => {
    const { container } = show(<Progress pct={75} label="3 of 4" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
    expect(container.querySelector<HTMLElement>(".fill")?.style.width).toBe("75%");
    expect(screen.getByText("3 of 4")).toHaveClass("count");
  });

  it("keeps the bar between empty and full", () => {
    const { container } = show(<Progress pct={140} />);
    expect(container.querySelector<HTMLElement>(".fill")?.style.width).toBe("100%");
    expect(container.querySelector(".count")).toBeNull();
  });
});

describe("Timeline", () => {
  it("marks the steps that are done, the one in hand and the ones to come", () => {
    const { container } = show(
      <Timeline
        items={[
          { title: "Hub created", meta: "Today", state: "done" },
          { title: "Model key", meta: "In progress", state: "now" },
          { title: "Invite people", meta: "Next", state: "next" },
        ]}
      />,
    );
    const steps = container.querySelectorAll("li");
    expect(steps[0]).toHaveClass("tl-item", "done");
    expect(steps[0].querySelector("svg")).toBeInTheDocument();
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[2]).toHaveClass("next");
    expect(steps[2]).not.toHaveAttribute("aria-current");
    expect(within(steps[1]).getByText("In progress")).toHaveClass("tl-meta");
  });
});

describe("DataTable", () => {
  const rows = [{ key: "a", cells: ["Alpha"] }];

  it("sits in a panel and leaves out the actions column when no row has actions", () => {
    const { container } = show(<DataTable columns={["Name"]} rows={rows} empty="None" />);
    expect(container.querySelector(".panel.table-card table.table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(1);
    expect(container.querySelector(".row-act")).toBeNull();
  });

  it("pins the actions column to the right edge", () => {
    const { container } = show(
      <DataTable columns={["Name"]} rows={[{ key: "a", cells: ["Alpha"], actions: <Button kind="quiet">Open</Button> }]} empty="None" />,
    );
    expect(container.querySelectorAll(".row-act")).toHaveLength(2);
  });

  it("offers the action next to the empty text when there are no rows", async () => {
    const onAdd = vi.fn();
    show(<DataTable columns={["Name"]} rows={[]} empty="No group yet." emptyAction={<Button onClick={onAdd}>Add a group</Button>} />);
    expect(screen.getByText("No group yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add a group" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe("Cell", () => {
  it("shows a lead mark, a bold name and a line under it", () => {
    const { container } = show(<Cell text="Riders" lead={<Glyph name="chat" />} sub="Boda boda riders" />);
    expect(container.querySelector(".cell > .glyph")).toBeInTheDocument();
    expect(screen.getByText("Riders")).toHaveClass("cell-name");
    expect(screen.getByText("Boda boda riders")).toHaveClass("cell-sub");
  });

  it("makes the name a link when it has a place to go", () => {
    show(<Cell text="Riders" to="/h/x/groups/riders" />);
    expect(screen.getByRole("link", { name: "Riders" })).toHaveClass("cell-name");
  });

  it("leaves the name plain when it is not the strong part of the cell", () => {
    show(<Cell text="GLM-5.3" strong={false} lead={<Badge>HF</Badge>} />);
    expect(screen.getByText("GLM-5.3")).not.toHaveClass("cell-name");
    expect(screen.getByText("HF")).toHaveClass("badge");
  });
});

describe("Badge, Avatar and Glyph", () => {
  it("takes the first letters of the first two words for an avatar", () => {
    show(<Avatar name="Wanjiru Otieno Kamau" />);
    expect(screen.getByText("WO")).toHaveClass("badge", "avatar");
  });

  it("reads hyphens as word breaks and skips words that do not start with a letter", () => {
    expect(initials("seed-keeper")).toBe("SK");
    expect(initials("- Hub Steward")).toBe("HS");
    expect(initials("")).toBe("");
  });

  it("draws an icon in the glyph square", () => {
    const { container } = show(<Glyph name="chat" />);
    expect(container.querySelector(".glyph svg")).toBeInTheDocument();
  });
});

describe("Chip", () => {
  it.each(["use", "ok", "warn", "bad", "mute"] as const)("shows a %s chip", (kind) => {
    show(<Chip kind={kind}>Text</Chip>);
    expect(screen.getByText("Text")).toHaveClass("tag", kind);
  });

  it("shows a plain chip without a kind", () => {
    show(<Chip>Plain</Chip>);
    expect(screen.getByText("Plain").className).toBe("tag");
  });
});

describe("Card", () => {
  it("is a plain block when it has no title", () => {
    const { container } = show(<Card>inside</Card>);
    expect(container.querySelector("div.card")).toHaveTextContent("inside");
    expect(container.querySelector("section")).toBeNull();
    expect(container.querySelector(".card-head")).toBeNull();
  });

  it("puts the actions at the right of the title", () => {
    show(
      <Card title="Profile" actions={<Button kind="quiet">Edit</Button>}>
        inside
      </Card>,
    );
    const head = screen.getByRole("heading", { name: "Profile" }).parentElement;
    expect(head).toHaveClass("card-head");
    expect(within(head as HTMLElement).getByRole("button", { name: "Edit" }).parentElement).toHaveClass("card-actions");
  });

  it("tightens its padding when asked", () => {
    const { container } = show(<Card tight>inside</Card>);
    expect(container.querySelector(".card")).toHaveClass("tight");
  });

  it("is three parts: a header with the title and the actions, the content, and an optional footer of actions", () => {
    const { container } = show(
      <Card title="Profile" actions={<Button kind="quiet">Edit</Button>} footer={[<Button key="a" kind="quiet">Save</Button>, <Button key="b" kind="quiet">Cancel</Button>]}>
        inside
      </Card>,
    );
    const card = container.querySelector("section.card") as HTMLElement;
    expect(card.querySelector(":scope > .card-head")).toHaveTextContent("Profile");
    expect(card.querySelector(":scope > .card-body")).toHaveTextContent("inside");
    const foot = card.querySelector(":scope > .card-foot") as HTMLElement;
    expect(Array.from(foot.children).map((one) => one.textContent)).toEqual(["Save", "Cancel"]);
    expect(foot.previousElementSibling).toHaveClass("card-body");
  });

  it("has no footer unless it is given one, and no content wrapper when it has no header and no footer", () => {
    const { container } = show(<Card title="Profile">inside</Card>);
    expect(container.querySelector(".card-foot")).toBeNull();
    const plain = show(<Card>words</Card>);
    expect(plain.container.querySelector(".card > .card-body")).toBeNull();
  });

  it("hides the footer with the content when collapsed", () => {
    const { container } = show(
      <Card title="Profile" open={false} onToggle={() => undefined} footer={<Button kind="quiet">Save</Button>}>
        inside
      </Card>,
    );
    expect(container.querySelector(".card-foot")).toBeNull();
    expect(container.querySelector(".card-body")).toBeNull();
  });
});

describe("Detail", () => {
  it("wraps the pairs in a card with a title and actions", () => {
    const { container } = show(<Detail title="Profile" actions={<Button kind="quiet">Edit</Button>} pairs={[["Name", "Siaya"]]} />);
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(container.querySelector(".card dl.kv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});

describe("SettingRows", () => {
  it("lays each label and control side by side inside a settings list", () => {
    const { container } = show(<SettingRows rows={[{ label: "Hub name", control: "x" }]} />);
    expect(container.querySelector(".settings > .setting > .setting-label")).toHaveTextContent("Hub name");
    expect(container.querySelector(".setting > .setting-control")).toHaveTextContent("x");
  });

  it("wraps the rows in a card when it has a title", () => {
    show(<SettingRows title="General" rows={[{ label: "Hub name", control: "x" }]} />);
    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
  });

  it("ties a label to its control when the row says which one", () => {
    show(<SettingRows rows={[{ label: "Hub name", htmlFor: "hub", control: <TextControl id="hub" value="Siaya" /> }]} />);
    expect(screen.getByLabelText("Hub name")).toHaveValue("Siaya");
  });
});

describe("Controls", () => {
  it("reports what is typed into a text control and a text area", async () => {
    const onText = vi.fn();
    const onArea = vi.fn();
    show(
      <>
        <TextControl label="Name" value="" onChange={onText} />
        <TextareaControl label="About" value="" rows={2} onChange={onArea} />
      </>,
    );
    await userEvent.type(screen.getByLabelText("Name"), "a");
    await userEvent.type(screen.getByLabelText("About"), "b");
    expect(onText).toHaveBeenCalledWith("a");
    expect(onArea).toHaveBeenCalledWith("b");
    expect(screen.getByLabelText("About")).toHaveAttribute("rows", "2");
  });

  it("reports the option picked in a select control and shows the chevron", async () => {
    const onChange = vi.fn();
    const { container } = show(<SelectControl label="Joining" value="open" options={["open", { value: "ask", label: "Approval needed" }]} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Joining"), "Approval needed");
    expect(onChange).toHaveBeenCalledWith("ask");
    expect(container.querySelector(".control.ctl svg")).toBeInTheDocument();
  });

  it("dims a control that is switched off", () => {
    const { container } = show(<TextControl label="Name" value="x" disabled />);
    expect(container.querySelector(".control")).toHaveClass("off");
    expect(screen.getByLabelText("Name")).toBeDisabled();
  });
});

describe("Toggle", () => {
  it("shows a switch with its label and reports the new state", async () => {
    const onChange = vi.fn();
    show(<Toggle label="Tell me" on={false} onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Tell me" });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("cannot be flipped when it is disabled", async () => {
    const onChange = vi.fn();
    show(<Toggle label="Tell me" on disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ThemePicker", () => {
  it("shows the five themes as one radio group with the current one on", () => {
    show(<ThemePicker value="light" />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(within(group).getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Light" }).closest("label")).toHaveClass("theme-card", "on");
    expect(screen.getByRole("radio", { name: "Dark" }).closest("label")).not.toHaveClass("on");
  });

  it("shows three colour dots on each card and reports the theme picked", async () => {
    const onChange = vi.fn();
    const { container } = show(<ThemePicker value="dark" onChange={onChange} />);
    expect(container.querySelectorAll(".theme-card")[0].querySelectorAll(".theme-dots i")).toHaveLength(3);
    await userEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(onChange).toHaveBeenCalledWith("light");
  });
});

describe("AddTile", () => {
  it("links to the place where the thing is added", () => {
    show(<AddTile text="Add a group" to="/h/x/groups/add" note="Groups hold users" />);
    const tile = screen.getByRole("link", { name: /Add a group/ });
    expect(tile).toHaveClass("add");
    expect(tile).toHaveAttribute("href", "/h/x/groups/add");
    expect(screen.getByText("Groups hold users")).toHaveClass("add-note");
  });

  it("acts as a button when it has no place to go", async () => {
    const onClick = vi.fn();
    show(<AddTile text="Add" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("SearchField, SelectField and FilterChip", () => {
  it("names the search box by its placeholder and reports what is typed", async () => {
    const onChange = vi.fn();
    show(<SearchField placeholder="Find a role" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Find a role" }), "d");
    expect(onChange).toHaveBeenCalledWith("d");
  });

  it("lets a search box that is not told its value take its own typing", async () => {
    show(<SearchField placeholder="Find" />);
    await userEvent.type(screen.getByRole("searchbox"), "abc");
    expect(screen.getByRole("searchbox")).toHaveValue("abc");
  });

  it("names a select by its label and reports the option picked", async () => {
    const onChange = vi.fn();
    show(<SelectField icon="grid" label="Model" value="all" options={[{ value: "all", label: "All models" }, "claude"]} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Model"), "claude");
    expect(onChange).toHaveBeenCalledWith("claude");
    expect(screen.getByRole("option", { name: "All models" })).toBeInTheDocument();
  });

  it("shows a filter with a button that removes it and names what it removes", async () => {
    const onRemove = vi.fn();
    show(<FilterChip text="Model: GLM-5.3" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Model: GLM-5.3" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("FilterBar", () => {
  it("shows the search, the selects, the filters and what sits at the right", () => {
    const { container } = show(
      <FilterBar
        placeholder="Find a role"
        chips={["Model: GLM-5.3"]}
        onRemoveChip={() => {}}
        selects={[{ icon: "grid", label: "Model", value: "all", options: ["all", "claude"] }]}
        right={<span className="muted">Showing 1 of 4</span>}
      />,
    );
    const groups = container.querySelectorAll(".toolbar > .toolbar-group");
    expect(groups).toHaveLength(2);
    expect(within(groups[0] as HTMLElement).getByRole("searchbox")).toBeInTheDocument();
    expect(within(groups[0] as HTMLElement).getByLabelText("Model")).toBeInTheDocument();
    expect(groups[0].querySelector(".filter")).toHaveTextContent("Model: GLM-5.3");
    expect(groups[1]).toHaveTextContent("Showing 1 of 4");
  });

  it("tells the page which filter was removed", async () => {
    const onRemoveChip = vi.fn();
    show(<FilterBar placeholder="Find" chips={["Active", "Invited"]} onRemoveChip={onRemoveChip} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Invited" }));
    expect(onRemoveChip).toHaveBeenCalledWith("Invited");
  });

  it("reports what is typed in the search when the page holds the text", async () => {
    const onSearch = vi.fn();
    show(<FilterBar placeholder="Find" chips={[]} search="" onSearch={onSearch} />);
    await userEvent.type(screen.getByRole("searchbox"), "x");
    expect(onSearch).toHaveBeenCalledWith("x");
  });
});

describe("Toolbar", () => {
  it("leaves out the right group when there is nothing for it", () => {
    const { container, rerender } = show(<Toolbar left="L" />);
    expect(container.querySelectorAll(".toolbar-group")).toHaveLength(1);
    rerender(
      <I18nProvider initial={words}>
        <Toolbar left="L" right="R" />
      </I18nProvider>,
    );
    expect(container.querySelectorAll(".toolbar-group")).toHaveLength(2);
  });
});

describe("Tabs", () => {
  it("gives each tab the tab look", () => {
    show(<Tabs items={[{ to: "/a", label: "A", current: true }]} />);
    expect(screen.getByRole("link", { name: "A" })).toHaveClass("tab");
  });
});

describe("Empty and StatusLine", () => {
  it("puts the action under the text when there is one", async () => {
    const onClick = vi.fn();
    const { container } = show(<Empty text="No model yet." action={<Button onClick={onClick}>Add a model</Button>} />);
    expect(container.querySelector(".empty > span")).toHaveTextContent("No model yet.");
    await userEvent.click(screen.getByRole("button", { name: "Add a model" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks a status line as muted text", () => {
    show(<StatusLine text="Saved" />);
    expect(screen.getByRole("status")).toHaveClass("muted");
  });
});

describe("Layout", () => {
  it("leaves the gap at its default and sets it only when it differs", () => {
    const { container } = show(
      <>
        <Stack>a</Stack>
        <Stack gap={24}>b</Stack>
        <Row>c</Row>
        <Row gap={6}>d</Row>
      </>,
    );
    const stacks = container.querySelectorAll<HTMLElement>(".stack");
    expect(variable(stacks[0], "--stack-gap")).toBe("");
    expect(variable(stacks[1], "--stack-gap")).toBe("24px");
    const rows = container.querySelectorAll<HTMLElement>(".row");
    expect(variable(rows[0], "--row-gap")).toBe("");
    expect(variable(rows[1], "--row-gap")).toBe("6px");
  });

  it("sets the narrowest cell of a grid and its gap", () => {
    const { container } = show(
      <Grid min={11} gap={12}>
        x
      </Grid>,
    );
    const grid = container.querySelector<HTMLElement>(".grid");
    expect(variable(grid, "--grid-min")).toBe("11rem");
    expect(variable(grid, "--grid-gap")).toBe("12px");
  });

  it("splits two columns by the ratio", () => {
    const { container } = show(<TwoCol ratio="1fr 1fr" left="L" right="R" />);
    expect(variable(container.querySelector<HTMLElement>(".two-col"), "--cols")).toBe("1fr 1fr");
    expect(container.querySelectorAll(".two-col > .stack")).toHaveLength(2);
  });

  it("shows a section title with something at its right and a note", () => {
    const { container } = show(
      <>
        <SectionTitle title="Finish setting up" right={<span className="count">3 of 4</span>} />
        <Note>One sentence.</Note>
      </>,
    );
    expect(container.querySelector(".section-head > h2")).toHaveTextContent("Finish setting up");
    expect(screen.getByText("One sentence.")).toHaveClass("note");
  });
});

type Seen = { current: unknown };

function Held({ spec, start, seen, extra }: { spec: FieldSpec; start?: unknown; seen: Seen; extra?: object }) {
  const [value, setValue] = useState<unknown>(start);
  return (
    <Field
      spec={spec}
      value={value}
      onChange={(next) => {
        seen.current = next;
        setValue(next);
      }}
      {...extra}
    />
  );
}

const held = (spec: FieldSpec, start?: unknown, extra?: object) => {
  const seen: Seen = { current: undefined };
  const view = show(<Held spec={spec} start={start} seen={seen} extra={extra} />);
  return { seen, ...view };
};

describe("Field in the design", () => {
  it("puts the star after the label of a required field", () => {
    const { container } = held({ name: "name", component: "text", required: true });
    expect(container.querySelector(".field-label .req")).toHaveTextContent("*");
  });

  it("shows the error under the control, outlines the control, and keeps it out of the label", () => {
    const { container } = held({ name: "name", component: "text", required: true }, "", { error: "A name is needed" });
    expect(screen.getByText("A name is needed")).toHaveClass("field-error");
    expect(container.querySelector(".control")).toHaveClass("bad");
    expect(screen.getByLabelText("Name *")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Name *")).toHaveAccessibleDescription("A name is needed");
  });

  it("shows a hint under the control", () => {
    held({ name: "name", component: "text" }, "", { hint: "Shown to everyone" });
    expect(screen.getByText("Shown to everyone")).toHaveClass("hint");
  });

  it("dims and locks a disabled field", () => {
    const { container } = held({ name: "name", component: "text" }, "Riders", { disabled: true });
    expect(container.querySelector(".control")).toHaveClass("off");
    expect(screen.getByLabelText("Name")).toBeDisabled();
  });

  it("shows the unit after a number", () => {
    const { container } = held({ name: "limit", component: "number" }, 20, { unit: "tokens" });
    expect(container.querySelector(".control .unit")).toHaveTextContent("tokens");
  });

  it("shows a text field's placeholder", () => {
    held({ name: "name", component: "text" }, "", { placeholder: "Group name" });
    expect(screen.getByPlaceholderText("Group name")).toBeInTheDocument();
  });

  it("can show a stored secret as set and reveal what is typed with the eye button", async () => {
    const { seen } = held({ name: "key", component: "secret" }, "", { set: true });
    expect(screen.getByText("set")).toHaveClass("tag", "ok");
    const input = screen.getByLabelText("Key") as HTMLInputElement;
    await userEvent.type(input, "sk-1");
    expect(seen.current).toBe("sk-1");
    await userEvent.click(screen.getByRole("button", { name: "Show key" }));
    expect(input).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide key" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("names the file chosen and says so when there is none", async () => {
    const { container } = held({ name: "attachment", component: "file" });
    expect(screen.getByText("No file attached")).toHaveClass("soft");
    const file = new File(["x"], "plan.txt", { type: "text/plain" });
    await userEvent.upload(container.querySelector("input[type=file]") as HTMLInputElement, file);
    expect(screen.getByText("plan.txt")).toBeInTheDocument();
  });

  it("opens the file picker from the Choose button", async () => {
    const { container } = held({ name: "attachment", component: "file" });
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    await userEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("says On or Off beside a switch", async () => {
    held({ name: "enabled", component: "toggle" }, false);
    expect(screen.getByText("Off")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "enabled" }));
    expect(screen.getByText("On")).toBeInTheDocument();
  });

  it("lets the user tick several options when a list of words has options to choose from", async () => {
    const { seen } = held({ name: "days", component: "chips", options: ["Mon", "Tue", "Wed"] }, "Mon");
    const group = screen.getByRole("group", { name: "days" });
    expect(within(group).getByRole("checkbox", { name: "Mon" })).toBeChecked();
    await userEvent.click(within(group).getByRole("checkbox", { name: "Wed" }));
    expect(seen.current).toBe("Mon, Wed");
    await userEvent.click(within(group).getByRole("checkbox", { name: "Mon" }));
    expect(seen.current).toBe("Wed");
  });

  it("marks the chosen radio option as on", async () => {
    held({ name: "mode", component: "radios", options: ["open", "confirmed"] }, "open");
    expect(screen.getByRole("radio", { name: "open" }).closest("label")).toHaveClass("opt", "on");
    await userEvent.click(screen.getByRole("radio", { name: "confirmed" }));
    expect(screen.getByRole("radio", { name: "confirmed" }).closest("label")).toHaveClass("on");
  });

  it("shows a calendar mark before a date", () => {
    const { container } = held({ name: "due", component: "date" });
    expect(container.querySelector(".control > svg")).toBeInTheDocument();
  });

  it("lays a field out as a settings row when asked", () => {
    const { container } = held({ name: "name", component: "text" }, "x", { layout: "rows", error: "Bad" });
    expect(container.querySelector(".setting > .setting-label")).toHaveTextContent("Name");
    expect(container.querySelector(".setting > .setting-control .field-error")).toHaveTextContent("Bad");
    expect(screen.getByLabelText("Name")).toHaveValue("x");
  });
});

describe("FormObject in the design", () => {
  const three: FieldSpec[] = [
    { name: "name", component: "text", required: true },
    { name: "note", component: "textarea" },
    { name: "enabled", component: "toggle" },
  ];
  const four: FieldSpec[] = [...three, { name: "limit", component: "number" }];

  it("stacks up to three fields", () => {
    const { container } = show(<FormObject title="Add" fields={three} onSubmit={async () => {}} onCancel={() => {}} />);
    expect(container.querySelector(".settings")).toBeNull();
    expect(container.querySelectorAll(".field")).toHaveLength(3);
  });

  it("turns four or more fields into settings rows", () => {
    const { container } = show(<FormObject title="Add" fields={four} onSubmit={async () => {}} onCancel={() => {}} />);
    expect(container.querySelectorAll(".settings > .setting")).toHaveLength(4);
  });

  it("names the tool that fills the form", () => {
    show(<FormObject title="" tool="ai_set_limits" fields={three} onSubmit={async () => {}} onCancel={() => {}} />);
    expect(screen.getByText("ai_set_limits")).toHaveClass("form-tool");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("marks each blank required field and takes the mark away once it is typed in", async () => {
    show(<FormObject title="Add" fields={three} onSubmit={async () => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Required")).toHaveClass("field-error");
    await userEvent.type(screen.getByLabelText("Name *"), "a");
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Required: name");
  });

  it("shows the errors the page hands in under their own fields", () => {
    show(<FormObject title="Add" fields={three} errors={{ note: "Too long" }} onSubmit={async () => {}} onCancel={() => {}} />);
    expect(screen.getByText("Too long")).toHaveClass("field-error");
    expect(screen.getByLabelText("note")).toHaveAttribute("aria-invalid", "true");
  });

  it("puts the chip beside the buttons when the change waits for approval", () => {
    const { container } = show(<FormObject title="Add" fields={three} pending onSubmit={async () => {}} onCancel={() => {}} />);
    expect(container.querySelector(".form-foot")).toContainElement(screen.getByText("Waiting for approval"));
  });
});
