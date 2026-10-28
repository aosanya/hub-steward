import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ActionCard, Chip, EditCard, FormCard, FromChat, ListCard, ResultCard, RowsCard } from ".";

const words = {
  en: {
    approve: "Approve",
    decline: "Decline",
    cancel: "Cancel",
    save: "Save",
    "ui.nothingRecorded": "Nothing is recorded until you approve.",
    "ui.nothingUntilPress": "Nothing is recorded until you press {action}.",
    "ui.open": "Open",
    "ui.new": "new",
    "ui.changed": "changed",
    "ui.answerTo": "Answer to:",
    "ui.answerFromChat": "Answer from the chat",
    "ui.clear": "Clear",
  },
};

const show = (ui: ReactElement) =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </I18nProvider>,
  );

describe("ActionCard in the design", () => {
  it("is a message card with the title as its heading", () => {
    const { container } = show(<ActionCard title="Join request" text="Wanjiru wants in" />);
    expect(container.querySelector(".msg-card")).toBeInTheDocument();
    expect(screen.getByText("Wanjiru wants in")).toHaveClass("msg-detail");
  });

  it("says nothing is recorded yet when it is pending", () => {
    show(<ActionCard title="Join request" state="pending" />);
    expect(screen.getByText("Nothing is recorded until you approve.")).toBeInTheDocument();
  });

  it("shows the buttons it is given instead of Approve and Decline", async () => {
    const onClick = vi.fn();
    show(<ActionCard title="Join request" buttons={[{ label: "Let in", kind: "primary", onClick }]} />);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Let in" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("ListCard", () => {
  it("shows a row for each item with its initials, its line, its chip and a link to open it", () => {
    show(
      <ListCard
        title="3 roles use Hugging Face"
        items={[
          { name: "Dispatcher", meta: "Riders and customers", chip: <Chip kind="use">In use</Chip>, to: "/h/x/agents/dispatcher" },
          { name: "Hub Steward" },
        ]}
        nav={{ label: "Open Agents", to: "/h/x/agents" }}
      />,
    );
    const rows = document.querySelectorAll(".list-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText("D")).toHaveClass("badge");
    expect(within(rows[0] as HTMLElement).getByText("Riders and customers")).toHaveClass("list-meta");
    expect(within(rows[0] as HTMLElement).getByText("In use")).toHaveClass("tag", "use");
    expect(within(rows[0] as HTMLElement).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/h/x/agents/dispatcher");
    expect(within(rows[1] as HTMLElement).getByText("HS")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Agents" })).toHaveAttribute("href", "/h/x/agents");
    expect(document.querySelector(".msg-card")).toHaveClass("wide");
  });
});

describe("RowsCard", () => {
  it("marks each row as new or changed and shows the columns", () => {
    show(
      <RowsCard
        title="Three goals"
        columns={["Goal", "Owner"]}
        rows={[
          { cells: ["Fair seats", "Manager"] },
          { kind: "changed", cells: ["Network", "Watcher"] },
        ]}
      />,
    );
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "Goal", "Owner"]);
    expect(screen.getByText("new")).toHaveClass("tag", "ok");
    expect(screen.getByText("changed")).toHaveClass("tag", "warn");
    expect(document.querySelector("table.mini")).toBeInTheDocument();
  });

  it("leaves out the heading row when it has no columns", () => {
    show(<RowsCard title="Goals" rows={[{ cells: ["Fair seats"] }]} />);
    expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
  });
});

describe("ResultCard", () => {
  it("shows a plain line or a label with its value for each result", () => {
    show(<ResultCard title="Group added" rows={["Riders now has 8 users", { label: "Joining", value: "Open" }]} />);
    expect(document.querySelector(".msg-title")).toHaveClass("ok");
    expect(screen.getByText("Riders now has 8 users")).toBeInTheDocument();
    expect(screen.getByText("Joining")).toHaveClass("list-meta");
    expect(screen.getByText("Open")).toBeInTheDocument();
  });
});

describe("EditCard", () => {
  it("hands back the edited values when saved", async () => {
    const onSave = vi.fn();
    show(<EditCard title="Edit the profile" rows={[{ label: "Name", value: "Siaya" }, { label: "Place", value: "Siaya" }]} onSave={onSave} />);
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Siaya Lab");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(["Siaya Lab", "Siaya"]);
  });

  it("tells the page when it is cancelled", async () => {
    const onCancel = vi.fn();
    show(<EditCard title="Edit" rows={[{ label: "Name", value: "x" }]} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("FormCard", () => {
  const fields = [
    { name: "name", label: "Name", kind: "text" as const, hint: "Shown to everyone" },
    { name: "joining", label: "Joining", kind: "select" as const, options: ["Open", "Approval needed"] },
    { name: "about", label: "About", kind: "textarea" as const },
    { name: "notify", label: "Tell me", kind: "toggle" as const },
  ];

  it("shows every kind of field, the hint under a field and what pressing the button does", () => {
    show(<FormCard title="Add a group" fields={fields} submit="Add group" />);
    expect(screen.getByRole("heading", { name: "Add a group" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByText("Shown to everyone")).toHaveClass("hint");
    expect(screen.getByLabelText("Joining")).toHaveValue("Open");
    expect(screen.getByLabelText("About").tagName).toBe("TEXTAREA");
    expect(screen.getByRole("switch", { name: "Tell me" })).not.toBeChecked();
    expect(screen.getByText("Nothing is recorded until you press Add group.")).toHaveClass("msg-note");
  });

  it("hands back what was filled in under each field's name", async () => {
    const onSubmit = vi.fn();
    show(<FormCard fields={fields} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Name"), "Riders");
    await userEvent.selectOptions(screen.getByLabelText("Joining"), "Approval needed");
    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Riders", joining: "Approval needed", about: "", notify: true });
  });

  it("uses the hint it is given instead of the default sentence", () => {
    show(<FormCard fields={fields} hint="Only you see this." />);
    expect(screen.getByText("Only you see this.")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing is recorded/)).not.toBeInTheDocument();
  });
});

describe("FromChat", () => {
  it("shows the question it answers, the title and the content, and clears on request", async () => {
    const onClear = vi.fn();
    show(
      <FromChat prompt="Which roles use Hugging Face?" title="3 roles" onClear={onClear}>
        <p>the answer</p>
      </FromChat>,
    );
    expect(screen.getByRole("region", { name: "Answer from the chat" })).toBeInTheDocument();
    expect(screen.getByText("Which roles use Hugging Face?").tagName).toBe("STRONG");
    expect(screen.getByText("3 roles")).toHaveClass("muted");
    expect(screen.getByText("the answer")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
