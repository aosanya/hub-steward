import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, proposals, renderPage } from "../spec/profileTesting";
import { GeneralView } from "./GeneralView";

vi.mock("../../wakala/mcp");

const languages = {
  studio_default: "en",
  content: ["en", "hu"],
  content_default: "en",
  languages: [
    { code: "en", default: true },
    { code: "hu", default: false },
  ],
};

const open = async (replies: Record<string, unknown> = {}) => {
  answerWith({
    instance_get_join_mode: { join_mode: "open" },
    instance_get_languages: languages,
    agency_propose_write: { status: "pending" },
    ...replies,
  });
  renderPage(<GeneralView />, "general");
  await screen.findByRole("combobox", { name: "Joining" });
};

const optionsOf = (name: string) =>
  [...screen.getByRole("combobox", { name }).querySelectorAll("option")].map((option) => [option.value, option.textContent]);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.mocked(callTool).mockReset();
});

describe("the general page", () => {
  it("shows how people join and the default language in the Hub card", async () => {
    await open();

    expect(screen.getByRole("heading", { name: "General", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hub", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Joining" })).toHaveValue("open");
    expect(screen.getByRole("combobox", { name: "Default language" })).toHaveValue("en");
  });

  it("offers to join openly or by approval", async () => {
    await open();

    expect(optionsOf("Joining")).toEqual([
      ["open", "Open to join"],
      ["confirmed", "Approval required"],
    ]);
  });

  it("offers all six languages by their own names, then any other language the hub already has", async () => {
    await open();

    expect(optionsOf("Default language")).toEqual([
      ["en", "English"],
      ["de", "Deutsch"],
      ["sw", "Kiswahili"],
      ["es", "Español"],
      ["fr", "Français"],
      ["zh", "中文"],
      ["hu", "Magyar"],
    ]);
  });

  it("offers exactly the seven languages when the hub has only some of them", async () => {
    await open({ instance_get_languages: { studio_default: "en", content: ["en"], content_default: "en", languages: [{ code: "en", default: true }] } });

    expect(optionsOf("Default language").map(([code]) => code)).toEqual(["en", "de", "sw", "es", "fr", "zh", "hu"]);
  });

  it("shows approval required when the hub is approval-only", async () => {
    await open({ instance_get_join_mode: { join_mode: "confirmed" } });

    expect(screen.getByRole("combobox", { name: "Joining" })).toHaveValue("confirmed");
  });

  it("says the page could not be loaded in the error style and keeps the title when the settings cannot be read", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("offline"));
    renderPage(<GeneralView />, "general");

    expect(await screen.findByText("The page could not be loaded.")).toHaveClass("error");
    expect(screen.getByRole("heading", { name: "General", level: 1 })).toBeInTheDocument();
  });
});

describe("the theme", () => {
  it("offers the five themes and marks the dark one as chosen at first", async () => {
    await open();

    const themes = within(screen.getByRole("radiogroup", { name: "Theme" })).getAllByRole("radio");

    expect(themes.map((radio) => radio.getAttribute("value"))).toEqual(["dark", "light", "midnight", "forest", "contrast"]);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("applies the chosen theme at once, remembers it in the browser and sends nothing to the hub", async () => {
    const user = userEvent.setup();
    await open();
    const calls = vi.mocked(callTool).mock.calls.length;

    await user.click(screen.getByRole("radio", { name: "Light" }));

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(vi.mocked(callTool).mock.calls).toHaveLength(calls);
  });
});

describe("saving the settings", () => {
  it("flashes Save changes only once a setting differs from the saved one", async () => {
    const user = userEvent.setup();
    await open();
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).not.toHaveClass("flash");

    await user.selectOptions(screen.getByRole("combobox", { name: "Joining" }), "confirmed");

    expect(save).toHaveClass("flash");
  });

  it("asks for approval to make joining approval-only and shows it pending under the control", async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(screen.getByRole("combobox", { name: "Joining" }), "confirmed");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Pending approval")).toBeInTheDocument();
    expect(screen.getByText("Nothing is recorded until you approve.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Joining" })).toHaveValue("confirmed");
    expect(proposals()).toEqual([
      { kind: "instance_set_join_mode", summary: "Make joining approval-only", payload: { join_mode: "confirmed" } },
    ]);
  });

  it("asks for approval to make another language the default and keeps the others", async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(screen.getByRole("combobox", { name: "Default language" }), "hu");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Pending approval")).toBeInTheDocument();
    expect(proposals()).toEqual([
      {
        kind: "instance_set_languages",
        summary: "Make hu the default language",
        payload: { studio_default: "en", content: ["en", "hu"], content_default: "hu" },
      },
    ]);
  });

  it("asks for approval to make a language the hub does not offer yet the default and adds it to the hub's languages", async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(screen.getByRole("combobox", { name: "Default language" }), "sw");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Pending approval")).toBeInTheDocument();
    expect(proposals()).toEqual([
      {
        kind: "instance_set_languages",
        summary: "Make sw the default language",
        payload: { studio_default: "en", content: ["en", "hu", "sw"], content_default: "sw" },
      },
    ]);
  });

  it("asks for both changes when both were made", async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(screen.getByRole("combobox", { name: "Joining" }), "confirmed");
    await user.selectOptions(screen.getByRole("combobox", { name: "Default language" }), "hu");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findAllByText("Pending approval");
    expect(
      proposals()
        .map((proposal) => proposal.kind)
        .sort(),
    ).toEqual(["instance_set_join_mode", "instance_set_languages"]);
    expect(screen.getAllByText("Pending approval")).toHaveLength(2);
  });

  it("asks for nothing when nothing was changed", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(callsOf("agency_propose_write")).toEqual([]);
    expect(screen.queryByText("Pending approval")).not.toBeInTheDocument();
  });

  it("takes the pending mark away when the choice is changed again", async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(screen.getByRole("combobox", { name: "Joining" }), "confirmed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Pending approval");

    await user.selectOptions(screen.getByRole("combobox", { name: "Joining" }), "open");

    expect(screen.queryByText("Pending approval")).not.toBeInTheDocument();
  });

  it("says the change could not be sent in the error style when the proposal fails", async () => {
    const user = userEvent.setup();
    await open({
      agency_propose_write: () => {
        throw new Error("offline");
      },
    });
    await user.selectOptions(screen.getByRole("combobox", { name: "Joining" }), "confirmed");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const note = await screen.findByText("The change could not be sent.");
    expect(note).toHaveClass("error");
    expect(note).toHaveAttribute("role", "status");
    expect(screen.queryByText("Pending approval")).not.toBeInTheDocument();
  });
});

describe("renaming the hub", () => {
  const openForm = async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole("button", { name: "Rename the hub" }));
    return user;
  };

  it("opens a form with a name field, a Save button and a Cancel button", async () => {
    await openForm();

    const form = screen.getByRole("form", { name: "Rename the hub" });

    expect(within(form).getByRole("textbox", { name: "Name" })).toHaveValue("");
    expect(within(form).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("asks for approval to rename the hub, says it waits for approval and closes the form", async () => {
    const user = await openForm();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Siaya Hub");

    await user.click(screen.getByRole("button", { name: "Save" }));

    const note = await screen.findByText("Waiting for approval");
    expect(note).toHaveAttribute("role", "status");
    expect(screen.queryByRole("form", { name: "Rename the hub" })).not.toBeInTheDocument();
    expect(proposals()).toEqual([{ kind: "instance_rename", summary: "Rename this hub to Siaya Hub", payload: { name: "Siaya Hub" } }]);
  });

  it("asks for a name and sends nothing when the name is empty", async () => {
    const user = await openForm();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: Name");
    expect(callsOf("agency_propose_write")).toEqual([]);
  });

  it("says the change could not be sent and keeps the form and what was typed when the proposal fails", async () => {
    const user = userEvent.setup();
    await open({
      agency_propose_write: () => {
        throw new Error("offline");
      },
    });
    await user.click(screen.getByRole("button", { name: "Rename the hub" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Siaya Hub");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The change could not be sent.");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Siaya Hub");
  });

  it("closes without sending anything when cancelled", async () => {
    const user = await openForm();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Siaya Hub");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("form", { name: "Rename the hub" })).not.toBeInTheDocument();
    expect(callsOf("agency_propose_write")).toEqual([]);
  });
});
