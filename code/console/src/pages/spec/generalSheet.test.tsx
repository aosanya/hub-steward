import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeneralSheet } from "./generalSheet";
import { clearPages, installPage, renderSpec } from "./specHarness.test-helper";

vi.mock("../../data/registry", () => import("./fakeRegistry"));

const row = { joining: "open", default_language: "en", languages: ["en", "sw"] };

const reload = vi.fn();

const open = (over: Record<string, unknown> = {}) => renderSpec(<GeneralSheet hubId="h1" row={{ ...row, ...over }} reload={reload} />);

const actions = (general: unknown, language: unknown = vi.fn(async () => "done"), hubname: unknown = vi.fn(async () => "done")) =>
  installPage("general", { actions: { general, language } as never }) && installPage("profile", { actions: { hubname } as never });

beforeEach(() => {
  clearPages();
  reload.mockReset();
});

describe("the General sheet", () => {
  it("shows how people join and the default language, with the choices the hub offers", () => {
    open();

    expect(screen.getByLabelText("Joining")).toHaveValue("open");
    expect(screen.getByLabelText("Default language")).toHaveValue("en");
    const joins = within(screen.getByLabelText("Joining")).getAllByRole("option").map((option) => option.textContent);
    expect(joins).toEqual(["Open to join", "Approval required"]);
  });

  it("shows a dash for a joining mode the sheet does not know", () => {
    open({ joining: "invite-only" });

    expect(within(screen.getByLabelText("Joining")).getAllByRole("option")[0]).toHaveTextContent("-");
  });

  it("keeps a default language the hub has that the app does not list", () => {
    open({ default_language: "lg", languages: ["lg"] });

    const codes = within(screen.getByLabelText("Default language")).getAllByRole("option").map((option) => (option as HTMLOptionElement).value);
    expect(codes).toContain("lg");
    expect(screen.getByLabelText("Default language")).toHaveValue("lg");
  });

  it("sends nothing when Save changes is pressed with no edit", async () => {
    const general = vi.fn(async () => "done");
    actions(general);
    open();

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(general).not.toHaveBeenCalled();
  });

  it("sends only the joining mode when only that was changed, and reloads", async () => {
    const general = vi.fn(async () => "done");
    const language = vi.fn(async () => "done");
    actions(general, language);
    open();

    await userEvent.selectOptions(screen.getByLabelText("Joining"), "confirmed");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(general).toHaveBeenCalledWith("h1", { join_mode: "confirmed" }));
    expect(language).not.toHaveBeenCalled();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("sends both changes when both were made", async () => {
    const general = vi.fn(async () => "done");
    const language = vi.fn(async () => "done");
    actions(general, language);
    open();

    await userEvent.selectOptions(screen.getByLabelText("Joining"), "confirmed");
    await userEvent.selectOptions(screen.getByLabelText("Default language"), "sw");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(language).toHaveBeenCalledWith("h1", { language: "sw" }));
    expect(general).toHaveBeenCalledWith("h1", { join_mode: "confirmed" });
  });

  it("marks the setting that is waiting for approval, and clears the mark when it is changed again", async () => {
    actions(vi.fn(async () => "accepted"));
    open();

    await userEvent.selectOptions(screen.getByLabelText("Joining"), "confirmed");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Pending approval")).toBeInTheDocument();
    expect(screen.getByText("Nothing is recorded until you approve.")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();

    await userEvent.selectOptions(screen.getByLabelText("Joining"), "open");

    expect(screen.queryByText("Pending approval")).not.toBeInTheDocument();
  });

  it("says the change could not be sent when either send is refused", async () => {
    actions(
      vi.fn(async () => "done"),
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    open();

    await userEvent.selectOptions(screen.getByLabelText("Joining"), "confirmed");
    await userEvent.selectOptions(screen.getByLabelText("Default language"), "sw");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("listing the hub in search", () => {
  const withListing = (listing: unknown, general: unknown = vi.fn(async () => "done"), language: unknown = vi.fn(async () => "done")) =>
    installPage("general", { actions: { general, language, listing } as never });

  const listedSwitch = () => screen.getByRole("switch", { name: "Listed in search" });

  it("shows the switch off for a hub that is not listed", () => {
    open({ listed: false });

    expect(screen.getByText("Listing")).toBeInTheDocument();
    expect(listedSwitch()).not.toBeChecked();
    expect(screen.getByText("Residents can find a listed hub by name or place when they search.")).toBeInTheDocument();
  });

  it("shows the switch on for a hub that is listed", () => {
    open({ listed: true });

    expect(listedSwitch()).toBeChecked();
  });

  it.each([undefined, "true", 1, null])("hides the row when listed is %j", (listed) => {
    open({ listed });

    expect(screen.queryByRole("switch", { name: "Listed in search" })).not.toBeInTheDocument();
    expect(screen.queryByText("Listing")).not.toBeInTheDocument();
  });

  it("sends only the listing when only the switch was changed, and reloads", async () => {
    const listing = vi.fn(async () => "done");
    const general = vi.fn(async () => "done");
    const language = vi.fn(async () => "done");
    withListing(listing, general, language);
    open({ listed: false });

    await userEvent.click(listedSwitch());
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(listing).toHaveBeenCalledWith("h1", { listed: true }));
    expect(listing).toHaveBeenCalledTimes(1);
    expect(general).not.toHaveBeenCalled();
    expect(language).not.toHaveBeenCalled();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("sends false when a listed hub is switched off", async () => {
    const listing = vi.fn(async () => "done");
    withListing(listing);
    open({ listed: true });

    await userEvent.click(listedSwitch());
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(listing).toHaveBeenCalledWith("h1", { listed: false }));
  });

  it("sends the listing along with the joining mode when both were changed", async () => {
    const listing = vi.fn(async () => "done");
    const general = vi.fn(async () => "done");
    withListing(listing, general);
    open({ listed: false });

    await userEvent.selectOptions(screen.getByLabelText("Joining"), "confirmed");
    await userEvent.click(listedSwitch());
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(listing).toHaveBeenCalledWith("h1", { listed: true }));
    expect(general).toHaveBeenCalledWith("h1", { join_mode: "confirmed" });
  });

  it("sends nothing when the switch is left as it was", async () => {
    const listing = vi.fn(async () => "done");
    withListing(listing);
    open({ listed: true });

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(listing).not.toHaveBeenCalled();
  });

  it("sends nothing when the switch is changed and changed back", async () => {
    const listing = vi.fn(async () => "done");
    withListing(listing);
    open({ listed: true });

    await userEvent.click(listedSwitch());
    await userEvent.click(listedSwitch());
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(listing).not.toHaveBeenCalled();
  });

  it("says the change could not be sent when the listing is refused", async () => {
    withListing(
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    open({ listed: false });

    await userEvent.click(listedSwitch());
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("renaming the hub", () => {
  const openRename = async (hubname: unknown) => {
    actions(vi.fn(async () => "done"), vi.fn(async () => "done"), hubname);
    open();
    await userEvent.click(screen.getByRole("button", { name: "Rename the hub" }));
  };

  it("asks for a name and sends nothing when the field is empty", async () => {
    const hubname = vi.fn(async () => "done");
    await openRename(hubname);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Required: Name")).toBeInTheDocument();
    expect(hubname).not.toHaveBeenCalled();
  });

  it("sends the new name, closes the form and reloads when it is done", async () => {
    const hubname = vi.fn(async () => "done");
    await openRename(hubname);

    await userEvent.type(screen.getByLabelText("Name"), "Siaya Growers");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(hubname).toHaveBeenCalledWith("h1", { name: "Siaya Growers" }));
    await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeInTheDocument());
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("says the rename is waiting for approval and closes the form", async () => {
    await openRename(vi.fn(async () => "accepted"));

    await userEvent.type(screen.getByLabelText("Name"), "Siaya Growers");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("keeps the form open with the reason when the hub refuses the rename", async () => {
    await openRename(
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await userEvent.type(screen.getByLabelText("Name"), "Siaya Growers");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("The change could not be sent.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Siaya Growers");
  });

  it("closes the form when Cancel is pressed", async () => {
    await openRename(vi.fn(async () => "done"));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });
});
