import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { fieldsFromSchema, missingFields } from "../data/schemaForm";
import { I18nProvider } from "../i18n";
import type { FieldSpec } from "../types";
import {
  ActionCard,
  Button,
  Card,
  Chips,
  DataTable,
  Detail,
  Empty,
  Field,
  FilterBar,
  FormObject,
  SchemaForm,
  SettingRows,
  Stats,
  StatusLine,
  Tabs,
  TitleRow,
} from ".";

vi.mock("../data/schemaForm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/schemaForm")>();
  return { ...actual, fieldsFromSchema: vi.fn(actual.fieldsFromSchema), missingFields: vi.fn(actual.missingFields) };
});

const words = {
  en: {
    approve: "Approve",
    decline: "Decline",
    submit: "Submit",
    cancel: "Cancel",
    required: "Required",
    pendingApproval: "This change waits for approval before it takes effect.",
    waitingForApproval: "Waiting for approval",
    commaSeparated: "Separate with commas",
    copy: "Copy",
    loadFailed: "Could not load this.",
    submitFailed: "That did not work.",
    "field.name": "Name",
    "field.key": "Key",
    "field.note": "Note",
  },
};

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

const show = (ui: ReactElement) =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter future={routerFuture}>{ui}</MemoryRouter>
    </I18nProvider>,
  );

type Seen = { current: unknown };

function Held({ spec, start, seen }: { spec: FieldSpec; start?: unknown; seen: Seen }) {
  const [value, setValue] = useState<unknown>(start);
  return (
    <Field
      spec={spec}
      value={value}
      onChange={(next) => {
        seen.current = next;
        setValue(next);
      }}
    />
  );
}

const heldField = (spec: FieldSpec, start?: unknown) => {
  const seen: Seen = { current: undefined };
  show(<Held spec={spec} start={start} seen={seen} />);
  return seen;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Button", () => {
  it("shows a filled button that does not submit a form unless asked to", () => {
    show(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("btn");
    expect(button).not.toHaveClass("quiet");
    expect(button).toHaveAttribute("type", "button");
  });

  it("shows a quiet button with the quiet look", () => {
    show(<Button kind="quiet">Later</Button>);
    expect(screen.getByRole("button", { name: "Later" })).toHaveClass("btn", "quiet");
  });

  it("calls the click handler once per click and not when disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("TitleRow", () => {
  it("shows the title as the page heading", () => {
    show(<TitleRow title="Models" />);
    expect(screen.getByRole("heading", { level: 1, name: "Models" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a primary button that calls onPrimary", async () => {
    const onPrimary = vi.fn();
    show(<TitleRow title="Models" primary="Add model" onPrimary={onPrimary} />);
    const button = screen.getByRole("button", { name: "Add model" });
    expect(button).not.toHaveClass("quiet");
    await userEvent.click(button);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("does not flash the primary button unless asked to", () => {
    show(<TitleRow title="Profile" primary="Save changes" />);
    expect(screen.getByRole("button", { name: "Save changes" })).not.toHaveClass("flash");
  });

  it("flashes the primary button when asked to", () => {
    show(<TitleRow title="Profile" primary="Save changes" primaryFlash />);
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveClass("flash");
  });

  it("shows the extra controls after the primary button", () => {
    show(
      <TitleRow title="General" primary="Save">
        <Button kind="quiet">Set language</Button>
      </TitleRow>,
    );
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names).toEqual(["Save", "Set language"]);
  });
});

describe("Stats", () => {
  it("shows each figure with its label", () => {
    show(<Stats items={[{ label: "Models", value: 3 }, { label: "Agents", value: "two" }]} />);
    expect(screen.getByText("Models")).toHaveClass("stat-label");
    expect(screen.getByText("3")).toHaveClass("stat-value");
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  it("shows the columns, the cells and a trailing actions cell per row", async () => {
    const onOpen = vi.fn();
    show(
      <DataTable
        columns={["Name", "Status"]}
        empty="Nothing here"
        rows={[
          { key: "a", cells: ["Alpha", "on"], actions: <Button kind="quiet" onClick={onOpen}>Open</Button> },
          { key: "b", cells: ["Beta", "off"] },
        ]}
      />,
    );
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(["Name", "Status", ""]);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getAllByRole("cell")).toHaveLength(3);
    expect(within(rows[1]).getByText("Alpha")).toBeInTheDocument();
    expect(within(rows[2]).getByText("off")).toBeInTheDocument();
    await userEvent.click(within(rows[1]).getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Nothing here")).not.toBeInTheDocument();
  });

  it("shows the empty text instead of a table when there are no rows", () => {
    show(<DataTable columns={["Name"]} rows={[]} empty="Nothing here" />);
    expect(screen.getByText("Nothing here")).toHaveClass("empty");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Detail", () => {
  it("shows each label beside its value", () => {
    const { container } = show(<Detail pairs={[["Limit", "5"], ["Set on", <b key="x">today</b>]]} />);
    expect(container.querySelector("dl.kv")).toBeInTheDocument();
    expect(screen.getByText("Limit").tagName).toBe("DT");
    expect(screen.getByText("5").tagName).toBe("DD");
    expect(screen.getByText("today").closest("dd")).toBeInTheDocument();
  });
});

describe("SettingRows", () => {
  it("shows each setting with its control", async () => {
    const onClick = vi.fn();
    const { container } = show(
      <SettingRows
        rows={[
          { label: "Join mode", control: <Button kind="quiet" onClick={onClick}>Open</Button> },
          { label: "Language", control: "en" },
        ]}
      />,
    );
    expect(container.querySelectorAll(".setting")).toHaveLength(2);
    expect(screen.getByText("Join mode")).toBeInTheDocument();
    expect(screen.getByText("en")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("Card", () => {
  it("shows its title as a heading above its content", () => {
    const { container } = show(
      <Card title="Add model">
        <p>inside</p>
      </Card>,
    );
    expect(container.querySelector("section.card")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Add model" })).toBeInTheDocument();
    expect(screen.getByText("inside")).toBeInTheDocument();
  });
});

describe("ActionCard", () => {
  it("shows the text with Approve and Decline that call their handlers", async () => {
    const onApprove = vi.fn();
    const onDecline = vi.fn();
    show(<ActionCard title="Join request" text="Wanjiru wants in" onApprove={onApprove} onDecline={onDecline} />);
    expect(screen.getByRole("heading", { name: "Join request" })).toBeInTheDocument();
    expect(screen.getByText("Wanjiru wants in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toHaveClass("quiet");
    expect(screen.getByRole("button", { name: "Approve" })).not.toHaveClass("quiet");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});

describe("Tabs", () => {
  it("marks only the current tab and links each tab to its place", () => {
    show(
      <Tabs
        items={[
          { to: "/h/x/approvals/pending", label: "Pending", current: true },
          { to: "/h/x/approvals/approved", label: "Approved", current: false },
        ]}
      />,
    );
    const pending = screen.getByRole("link", { name: "Pending" });
    const approved = screen.getByRole("link", { name: "Approved" });
    expect(pending).toHaveAttribute("aria-current", "page");
    expect(approved).not.toHaveAttribute("aria-current");
    expect(pending).toHaveAttribute("href", "/h/x/approvals/pending");
    expect(approved).toHaveAttribute("href", "/h/x/approvals/approved");
    expect(pending.closest("nav")).toHaveClass("tabs");
  });
});

describe("Chips and FilterBar", () => {
  it("shows each chip", () => {
    show(<Chips items={["Siaya", "Frankfurt"]} />);
    expect(screen.getByText("Siaya")).toHaveClass("tag");
    expect(screen.getByText("Frankfurt")).toHaveClass("tag");
  });

  it("shows a search box named by its placeholder with the chips beside it", () => {
    show(<FilterBar placeholder="Search people" chips={["Active", "Invited"]} />);
    const search = screen.getByRole("searchbox", { name: "Search people" });
    expect(search).toHaveAttribute("placeholder", "Search people");
    expect(screen.getByText("Active")).toHaveClass("tag");
    expect(screen.getByText("Invited")).toHaveClass("tag");
  });
});

describe("Empty and StatusLine", () => {
  it("shows an empty note, in the error colour when it failed", () => {
    const { rerender } = render(<Empty text="No rows" />);
    expect(screen.getByText("No rows")).toHaveClass("empty");
    expect(screen.getByText("No rows")).not.toHaveClass("error");
    rerender(<Empty text="No rows" failed />);
    expect(screen.getByText("No rows")).toHaveClass("empty", "error");
  });

  it("announces only a failed note as an alert, with or without an action beside it", () => {
    const { rerender } = render(<Empty text="No rows" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(<Empty text="Could not load" failed />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
    rerender(<Empty text="Could not load" failed action={<button type="button">Back</button>} />);
    expect(screen.getByRole("alert")).toContainElement(screen.getByRole("button", { name: "Back" }));
  });

  it("shows a status line that turns to the error colour when it failed", () => {
    const { rerender } = render(<StatusLine text="Saved" />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByRole("status")).toHaveClass("foot");
    expect(screen.getByRole("status")).not.toHaveClass("error");
    rerender(<StatusLine text="Not saved" failed />);
    expect(screen.getByRole("status")).toHaveClass("foot", "error");
  });
});

describe("Field", () => {
  it("labels a field with its translated name and a star when required", () => {
    heldField({ name: "name", component: "text", required: true });
    expect(screen.getByLabelText("Name *")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Name *")).toBeRequired();
  });

  it("labels a field with its own name when there is no translation", () => {
    heldField({ name: "group_id", component: "text" });
    expect(screen.getByLabelText("group_id")).not.toBeRequired();
  });

  it("types into a text field and reports each change", async () => {
    const seen = heldField({ name: "name", component: "text" });
    await userEvent.type(screen.getByLabelText("Name"), "Siaya");
    expect(screen.getByLabelText("Name")).toHaveValue("Siaya");
    expect(seen.current).toBe("Siaya");
  });

  it("shows a text field as read only when the field says so", () => {
    heldField({ name: "name", component: "text", readOnly: true }, "fixed");
    expect(screen.getByLabelText("Name")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Name")).toHaveValue("fixed");
  });

  it("hides a secret behind dots and stops the browser remembering it", async () => {
    const seen = heldField({ name: "key", component: "secret" });
    const input = screen.getByLabelText("Key");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "off");
    await userEvent.type(input, "sk-123");
    expect(seen.current).toBe("sk-123");
  });

  it("shows a long text as four rows", async () => {
    const seen = heldField({ name: "note", component: "textarea" });
    const box = screen.getByLabelText("Note");
    expect(box.tagName).toBe("TEXTAREA");
    expect(box).toHaveAttribute("rows", "4");
    await userEvent.type(box, "hello");
    expect(seen.current).toBe("hello");
  });

  it("gives a number for a number field and an empty string when it is cleared", async () => {
    const seen = heldField({ name: "limit", component: "number" });
    const input = screen.getByLabelText("limit");
    expect(input).toHaveAttribute("type", "number");
    await userEvent.type(input, "42");
    expect(seen.current).toBe(42);
    await userEvent.clear(input);
    expect(seen.current).toBe("");
  });

  it("lets the user pick from a select built from plain strings", async () => {
    const seen = heldField({ name: "join_mode", component: "select", options: ["open", "confirmed"] }, "open");
    const select = screen.getByLabelText("join_mode");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["open", "confirmed"]);
    await userEvent.selectOptions(select, "confirmed");
    expect(seen.current).toBe("confirmed");
    expect(select).toHaveValue("confirmed");
  });

  it("shows a select with labels and reports the value behind the chosen label", async () => {
    const seen = heldField(
      {
        name: "group_id",
        component: "select",
        options: [
          { value: "g1", label: "Farmers" },
          { value: "g2", label: "Buyers" },
        ],
      },
      "g1",
    );
    const select = screen.getByLabelText("group_id");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Farmers", "Buyers"]);
    await userEvent.selectOptions(select, "Buyers");
    expect(seen.current).toBe("g2");
  });

  it("shows radio buttons in one group and reports the chosen one", async () => {
    const seen = heldField({ name: "provider", component: "radios", options: ["a", "b", "c"], required: true });
    const group = screen.getByRole("radiogroup", { name: "provider *" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "a" })).not.toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "b" }));
    expect(seen.current).toBe("b");
    expect(screen.getByRole("radio", { name: "b" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "a" })).not.toBeChecked();
  });

  it("shows a switch that reports true and false", async () => {
    const seen = heldField({ name: "enabled", component: "toggle" }, false);
    const toggle = screen.getByRole("switch", { name: "enabled" });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(seen.current).toBe(true);
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(seen.current).toBe(false);
  });

  it("takes a date as the browser writes it", async () => {
    const seen = heldField({ name: "due", component: "date" });
    const input = screen.getByLabelText("due");
    expect(input).toHaveAttribute("type", "date");
    await userEvent.type(input, "2026-11-03");
    expect(seen.current).toBe("2026-11-03");
  });

  it("takes comma separated words and hints at it", async () => {
    const seen = heldField({ name: "tags", component: "chips" });
    const input = screen.getByLabelText("tags");
    expect(input).toHaveAttribute("placeholder", "Separate with commas");
    await userEvent.type(input, "a, b");
    expect(seen.current).toBe("a, b");
  });

  it("lets the user choose a file", async () => {
    const seen = heldField({ name: "attachment", component: "file" });
    const input = screen.getByLabelText("attachment");
    expect(input).toHaveAttribute("type", "file");
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await userEvent.upload(input, file);
    expect(seen.current).toBe(file);
  });

  it("shows a read only value with a Copy button that copies it", async () => {
    const user = userEvent.setup();
    heldField({ name: "key", component: "readonly" }, "sk-readonly-1");
    const input = screen.getByLabelText("Key");
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveValue("sk-readonly-1");
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe("sk-readonly-1");
  });
});

describe("FormObject", () => {
  const fields: FieldSpec[] = [
    { name: "name", component: "text", required: true },
    { name: "note", component: "textarea" },
  ];

  it("shows the title, the fields, Submit and Cancel and no error to begin with", () => {
    show(<FormObject title="Add model" fields={fields} onSubmit={async () => {}} onCancel={() => {}} />);
    expect(screen.getByRole("heading", { name: "Add model" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("quiet");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names the blank required fields and does not submit", async () => {
    const onSubmit = vi.fn(async () => {});
    show(
      <FormObject
        title="Add"
        fields={[...fields, { name: "key", component: "secret", required: true }]}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText("Name *"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Required: name, key");
    expect(screen.getByRole("alert")).toHaveClass("error");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits what was typed and clears an earlier required line", async () => {
    const onSubmit = vi.fn(async () => {});
    show(<FormObject title="Add" fields={fields} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name *"), "Siaya");
    await userEvent.type(screen.getByLabelText("Note"), "first");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Siaya", note: "first" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("gathers a value of the right kind from every kind of field", async () => {
    const onSubmit = vi.fn(async () => {});
    show(
      <FormObject
        title="Everything"
        fields={[
          { name: "provider", component: "select", options: ["a", "b", "c"] },
          { name: "mode", component: "radios", options: ["x", "y"] },
          { name: "limit", component: "number" },
          { name: "enabled", component: "toggle" },
          { name: "due", component: "date" },
          { name: "tags", component: "chips" },
          { name: "attachment", component: "file" },
          { name: "key", component: "readonly" },
          { name: "secret", component: "secret" },
        ]}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText("limit"), "7");
    await userEvent.click(screen.getByRole("switch"));
    await userEvent.type(screen.getByLabelText("due"), "2026-11-03");
    await userEvent.type(screen.getByLabelText("tags"), "a, b");
    await userEvent.type(screen.getByLabelText("secret"), "pw");
    await userEvent.upload(screen.getByLabelText("attachment"), new File(["x"], "x.txt"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({
      provider: "a",
      limit: 7,
      enabled: true,
      due: "2026-11-03",
      tags: "a, b",
      secret: "pw",
    });
  });

  it("sends the chosen radio, an unchecked toggle and an emptied number", async () => {
    const onSubmit = vi.fn(async () => {});
    show(
      <FormObject
        title="Mixed"
        fields={[
          { name: "mode", component: "radios", options: ["x", "y"] },
          { name: "limit", component: "number" },
          { name: "enabled", component: "toggle" },
        ]}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "y" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ mode: "y", limit: "", enabled: false });
  });

  it("starts a select on its first option so leaving it alone still submits that option", async () => {
    const onSubmit = vi.fn(async () => {});
    show(
      <FormObject
        title="Join"
        fields={[{ name: "join_mode", component: "select", options: ["open", "confirmed"], required: true }]}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByLabelText("join_mode *")).toHaveValue("open");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ join_mode: "open" });
  });

  it("holds back a required select that has no options yet", async () => {
    const onSubmit = vi.fn(async () => {});
    show(
      <FormObject
        title="Join"
        fields={[{ name: "group_id", component: "select", options: [], required: true }]}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Required: group_id");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("counts a zero and an unticked switch as filled in", async () => {
    const onSubmit = vi.fn(async () => {});
    show(
      <FormObject
        title="Counts"
        fields={[
          { name: "limit", component: "number", required: true },
          { name: "enabled", component: "toggle", required: true },
        ]}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText("limit *"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ limit: 0, enabled: false });
  });

  it("shows the sentence the submit handler returns as the error", async () => {
    const onSubmit = vi.fn(async () => "That name is taken.");
    show(<FormObject title="Add" fields={fields} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name *"), "Siaya");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That name is taken.");
    expect(screen.getByLabelText("Name *")).toHaveValue("Siaya");
  });

  it("says the save did not work when the submit handler fails", async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error("network");
    });
    show(<FormObject title="Add" fields={fields} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name *"), "Siaya");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That did not work.");
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("keeps Submit switched off while the submit is still running", async () => {
    let finish: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    show(<FormObject title="Add" fields={fields} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name *"), "Siaya");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish();
    expect(await screen.findByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("clears the typing and the error on Cancel and tells the page", async () => {
    const onCancel = vi.fn();
    show(
      <FormObject
        title="Add"
        fields={[...fields, { name: "attachment", component: "file" }]}
        onSubmit={async () => "Nope."}
        onCancel={onCancel}
      />,
    );
    await userEvent.type(screen.getByLabelText("Name *"), "Siaya");
    await userEvent.type(screen.getByLabelText("Note"), "something");
    await userEvent.upload(screen.getByLabelText("attachment"), new File(["x"], "x.txt"));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope.");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Name *")).toHaveValue("");
    expect(screen.getByLabelText("Note")).toHaveValue("");
    expect((screen.getByLabelText("attachment") as HTMLInputElement).files).toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says the change waits for approval when it is pending", () => {
    const { unmount } = show(<FormObject title="Add" fields={fields} pending onSubmit={async () => {}} onCancel={() => {}} />);
    expect(screen.getByText("This change waits for approval before it takes effect.")).toHaveClass("muted");
    expect(screen.getByText("Waiting for approval")).toHaveClass("tag", "warn");
    unmount();
    show(<FormObject title="Add" fields={fields} onSubmit={async () => {}} onCancel={() => {}} />);
    expect(screen.queryByText("This change waits for approval before it takes effect.")).not.toBeInTheDocument();
  });
});

describe("SchemaForm", () => {
  const schema = {
    required: ["provider", "key"],
    properties: {
      provider: { type: "string", enum: ["a", "b", "c"] },
      key: { type: "string", format: "password" },
      note: { type: "string", maxLength: 500 },
    },
  };

  beforeEach(() => {
    vi.mocked(fieldsFromSchema).mockClear();
    vi.mocked(missingFields).mockClear();
  });

  const fill = async () => {
    await userEvent.click(await screen.findByRole("radio", { name: "b" }));
    await userEvent.type(screen.getByLabelText("Key *"), "sk-1");
  };

  it("turns a field into a pick-list when choices are given for it", async () => {
    show(
      <SchemaForm
        title="Invite"
        schema={{ properties: { group_id: { type: "string" } }, required: ["group_id"] }}
        choices={{ group_id: [{ value: "g-1", label: "Riders" }] }}
        onSubmit={async () => {}}
        onCancel={() => {}}
      />,
    );

    const options = (await screen.findByLabelText("group_id *")).querySelectorAll("option");

    expect([...options].map((option) => [option.value, option.textContent])).toEqual([["g-1", "Riders"]]);
  });

  it("builds the fields from the schema and shows them", async () => {
    show(<SchemaForm title="Add model" schema={schema} onSubmit={async () => {}} onCancel={() => {}} />);
    expect(await screen.findByRole("radiogroup", { name: "provider *" })).toBeInTheDocument();
    expect(screen.getByLabelText("Key *")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add model" })).toBeInTheDocument();
    expect(fieldsFromSchema).toHaveBeenCalledWith(schema);
  });

  it("checks the values against the schema and hands them on when nothing is missing", async () => {
    const onSubmit = vi.fn(async () => {});
    show(<SchemaForm title="Add model" schema={schema} onSubmit={onSubmit} onCancel={() => {}} />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ provider: "b", key: "sk-1", note: "" });
    expect(missingFields).toHaveBeenCalledWith(schema, { provider: "b", key: "sk-1", note: "" });
  });

  it("shows what the check says is missing and does not hand the values on", async () => {
    vi.mocked(missingFields).mockReturnValueOnce(["key", "provider"]);
    const onSubmit = vi.fn(async () => {});
    show(<SchemaForm title="Add model" schema={schema} onSubmit={onSubmit} onCancel={() => {}} />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Required: key, provider");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("stops at the required fields the form can see for itself before checking the schema", async () => {
    show(<SchemaForm title="Add model" schema={schema} onSubmit={async () => {}} onCancel={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "Submit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Required: provider, key");
    expect(missingFields).not.toHaveBeenCalled();
  });

  it("shows the sentence the page's submit handler returns", async () => {
    show(<SchemaForm title="Add model" schema={schema} onSubmit={async () => "Key rejected."} onCancel={() => {}} />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Key rejected.");
  });

  it("says the save did not work when the values cannot be checked", async () => {
    vi.mocked(missingFields).mockImplementationOnce(() => {
      throw new Error("the schema changed");
    });
    const onSubmit = vi.fn(async () => {});
    show(<SchemaForm title="Add model" schema={schema} onSubmit={onSubmit} onCancel={() => {}} />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That did not work.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onCancel when the user cancels", async () => {
    const onCancel = vi.fn();
    show(<SchemaForm title="Add model" schema={schema} onSubmit={async () => {}} onCancel={onCancel} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("says it could not load when the schema is not valid", async () => {
    show(<SchemaForm title="Add model" schema={{ properties: 5 }} onSubmit={async () => {}} onCancel={() => {}} />);
    expect(await screen.findByText("Could not load this.")).toHaveClass("empty", "error");
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("builds the fields only once while the parent redraws with an equal schema", async () => {
    const view = show(<SchemaForm title="Add model" schema={{ ...schema }} onSubmit={async () => {}} onCancel={() => {}} />);
    await screen.findByLabelText("Key *");
    view.rerender(
      <I18nProvider initial={words}>
        <MemoryRouter future={routerFuture}>
          <SchemaForm title="Add model" schema={{ ...schema }} onSubmit={async () => {}} onCancel={() => {}} />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(fieldsFromSchema).toHaveBeenCalledTimes(1);
  });

  it("builds the fields again when the schema changes", async () => {
    const view = show(<SchemaForm title="Add model" schema={schema} onSubmit={async () => {}} onCancel={() => {}} />);
    await screen.findByLabelText("Key *");
    view.rerender(
      <I18nProvider initial={words}>
        <MemoryRouter future={routerFuture}>
          <SchemaForm title="Add model" schema={{ properties: { name: { type: "string" } } }} onSubmit={async () => {}} onCancel={() => {}} />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Key *")).not.toBeInTheDocument();
    expect(fieldsFromSchema).toHaveBeenCalledTimes(2);
  });
});
