import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { ButtonContent, buttonClass } from "./buttonLook";
import { FileControl, OptionControl, ReadonlyControl, SecretControl, textOf, type ControlAttrs } from "./fieldControls";
import { IconButton, IconLink, Segmented } from ".";

const words = {
  en: {
    copy: "Copy",
    modelKeySet: "set",
    "models.showKey": "Show key",
    "models.hideKey": "Hide key",
    "models.paste": "Paste your key",
    "ui.noFile": "No file attached",
    "ui.choose": "Choose",
  },
};

const attrs = (over: Partial<ControlAttrs> = {}): ControlAttrs => ({ id: "f", name: "f", disabled: false, ...over });
const frame = { bad: false, off: false };

const show = (ui: React.ReactElement) =>
  render(
    <I18nProvider initial={words}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </I18nProvider>,
  );

describe("buttonClass", () => {
  it("is a primary button by default", () => {
    expect(buttonClass({})).toBe("btn primary");
  });

  it("joins the kind, size, wide mark and extra class in that order and skips the empty ones", () => {
    expect(buttonClass({ kind: "quiet", size: "sm", wide: true }, "mine")).toBe("btn quiet sm act mine");
  });
});

describe("ButtonContent", () => {
  const order = (icon?: string) => {
    const { container } = render(
      <button>
        <ButtonContent icon={icon}>Go</ButtonContent>
      </button>,
    );
    return Array.from(container.querySelector("button")!.childNodes).map((node) => (node.nodeType === 3 ? "text" : "icon"));
  };

  it("shows the text alone without an icon", () => {
    expect(order()).toEqual(["text"]);
  });

  it("puts an ordinary icon before the text", () => {
    expect(order("plus")).toEqual(["icon", "text"]);
  });

  it.each(["arrow", "chevron", "chevron-down"])("puts the %s icon after the text", (icon) => {
    expect(order(icon)).toEqual(["text", "icon"]);
  });
});

describe("IconButton and IconLink", () => {
  it("names the button by its label and calls back on a press", async () => {
    const onClick = vi.fn();
    show(<IconButton icon="edit" label="Rename" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Rename" });
    expect(button).toHaveAttribute("title", "Rename");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks a dangerous button and keeps a disabled one from calling back", async () => {
    const onClick = vi.fn();
    show(<IconButton icon="trash" label="Delete" danger disabled onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveClass("icon-action", "danger");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("links to where it points", () => {
    show(<IconLink icon="arrow" label="Open it" to="/somewhere" />);
    expect(screen.getByRole("link", { name: "Open it" })).toHaveAttribute("href", "/somewhere");
  });
});

describe("Segmented", () => {
  it("shows the group by its label with the current item pressed", () => {
    show(
      <Segmented
        label="View"
        items={[
          { key: "a", label: "List", current: true, onSelect: () => {} },
          { key: "b", label: "Board", current: false, onSelect: () => {} },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "false");
  });

  it("selects the item that is pressed", async () => {
    const pick = vi.fn();
    show(
      <Segmented
        label="View"
        items={[
          { key: "a", label: "List", current: true, onSelect: () => {} },
          { key: "b", label: "Board", current: false, onSelect: pick },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Board" }));
    expect(pick).toHaveBeenCalledTimes(1);
  });
});

describe("textOf", () => {
  it("reads nothing as an empty string and anything else as its text", () => {
    expect(textOf(undefined)).toBe("");
    expect(textOf(null)).toBe("");
    expect(textOf(0)).toBe("0");
    expect(textOf(false)).toBe("false");
  });
});

describe("SecretControl", () => {
  const secret = (over: Partial<Parameters<typeof SecretControl>[0]> = {}) =>
    show(<SecretControl attrs={attrs()} frame={frame} value="hunter2" onChange={() => {}} {...over} />);

  it("hides the key until the eye is pressed and hides it again on a second press", async () => {
    secret();
    const input = screen.getByDisplayValue("hunter2");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show key" }));
    expect(input).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide key" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("asks to paste the key when the field is empty and takes a placeholder of its own", () => {
    secret({ value: undefined });
    expect(screen.getByPlaceholderText("Paste your key")).toBeInTheDocument();
  });

  it("says a key is already set", () => {
    secret({ set: true });
    expect(screen.getByText("set")).toBeInTheDocument();
  });

  it("passes what is typed", async () => {
    const onChange = vi.fn();
    secret({ value: "", onChange });
    await userEvent.type(screen.getByPlaceholderText("Paste your key"), "k");
    expect(onChange).toHaveBeenCalledWith("k");
  });

  it("locks the eye when the field is disabled", () => {
    secret({ attrs: attrs({ disabled: true }) });
    expect(screen.getByRole("button", { name: "Show key" })).toBeDisabled();
  });
});

describe("FileControl", () => {
  it("says no file is attached until one is chosen", () => {
    show(<FileControl attrs={attrs()} frame={frame} value={undefined} onChange={() => {}} />);
    expect(screen.getByText("No file attached")).toBeInTheDocument();
  });

  it("names the attached file", () => {
    show(<FileControl attrs={attrs()} frame={frame} value={new File(["x"], "list.csv")} onChange={() => {}} />);
    expect(screen.getByText("list.csv")).toBeInTheDocument();
  });

  it("hands over the chosen file", async () => {
    const onChange = vi.fn();
    const { container } = show(<FileControl attrs={attrs()} frame={frame} value={undefined} onChange={onChange} />);
    const file = new File(["x"], "list.csv", { type: "text/csv" });
    await userEvent.upload(container.querySelector("input[type=file]")!, file);
    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("opens the file picker from the Choose button", async () => {
    const { container } = show(<FileControl attrs={attrs()} frame={frame} value={undefined} onChange={() => {}} />);
    const click = vi.spyOn(container.querySelector("input[type=file]") as HTMLInputElement, "click");
    await userEvent.click(screen.getByRole("button", { name: "Choose" }));
    expect(click).toHaveBeenCalled();
  });
});

describe("ReadonlyControl", () => {
  it("shows the value read-only and copies it", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
    show(<ReadonlyControl attrs={attrs()} frame={frame} value="abc-123" />);
    expect(screen.getByDisplayValue("abc-123")).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(write).toHaveBeenCalledWith("abc-123");
  });
});

describe("OptionControl", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
  ];
  const control = (over: Partial<Parameters<typeof OptionControl>[0]> = {}) =>
    show(<OptionControl name="n" labelledBy="lab" options={options} off={false} multiple={false} isOn={(o) => o.value === "a"} onPick={() => {}} {...over} />);

  it("is a radio group when one can be chosen, with the chosen one on", () => {
    control();
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-labelledby", "lab");
    expect(screen.getByRole("radio", { name: "Alpha" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Beta" })).not.toBeChecked();
  });

  it("is a group of checkboxes when several can be chosen", () => {
    control({ multiple: true, isOn: () => true });
    expect(screen.getByRole("group")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("passes the option that is picked", async () => {
    const onPick = vi.fn();
    control({ onPick });
    await userEvent.click(screen.getByRole("radio", { name: "Beta" }));
    expect(onPick).toHaveBeenCalledWith(options[1]);
  });

  it("locks every option when off", () => {
    control({ off: true });
    expect(screen.getByRole("radio", { name: "Alpha" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Beta" })).toBeDisabled();
  });
});
