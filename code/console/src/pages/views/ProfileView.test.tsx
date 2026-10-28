import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callTool } from "../../wakala/mcp";
import { answerWith, callsOf, renderPage } from "../spec/profileTesting";
import { ProfileView } from "./ProfileView";

vi.mock("../../wakala/mcp");

const agency = { id: "270e07b7-agency", name: "Siaya Farmers' Group", description: "Farmers who pool their input orders." };

const open = async (replies: Record<string, unknown> = {}) => {
  answerWith({ agency_get_agency: { agency }, agency_update_agency: { id: "270e07b7-agency" }, ...replies });
  renderPage(<ProfileView />, "profile");
  await screen.findByRole("textbox", { name: "Name" });
};

beforeEach(() => {
  vi.mocked(callTool).mockReset();
});

describe("the profile page", () => {
  it("shows the agency's name and purpose in fields and its id beside a Copy button", async () => {
    await open();

    expect(screen.getByRole("heading", { name: "Profile", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Siaya Farmers' Group");
    expect(screen.getByRole("textbox", { name: "Purpose" })).toHaveValue("Farmers who pool their input orders.");
    expect(screen.getByText("270e07b7-agency")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("reads the agency once for the open hub", async () => {
    await open();

    expect(callsOf("agency_get_agency")).toHaveLength(1);
  });

  it("keeps the title and says the page could not be loaded when the agency cannot be read", async () => {
    vi.mocked(callTool).mockRejectedValue(new Error("offline"));
    renderPage(<ProfileView />, "profile");

    const failed = await screen.findByText("The page could not be loaded.");

    expect(failed).toHaveClass("error");
    expect(screen.getByRole("heading", { name: "Profile", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("copies the agency id to the clipboard", async () => {
    const user = userEvent.setup();
    await open();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("270e07b7-agency");
  });
});

describe("the profile page after the chat filled it", () => {
  const filled = { chatFill: { form: "profile", fill: { name: "", purpose: "Farmers of Siaya who grow crops and keep animals." } } };

  it("shows the Purpose the chat wrote, keeps the name, and records nothing until Save changes", async () => {
    answerWith({ agency_get_agency: { agency }, agency_update_agency: { id: "270e07b7-agency" } });
    renderPage(<ProfileView />, "profile", "", filled);

    await screen.findByRole("textbox", { name: "Name" });

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Siaya Farmers' Group");
    expect(screen.getByRole("textbox", { name: "Purpose" })).toHaveValue("Farmers of Siaya who grow crops and keep animals.");
    expect(callsOf("agency_update_agency")).toEqual([]);
  });

  it("saves the chat's Purpose when Save changes is pressed", async () => {
    const user = userEvent.setup();
    answerWith({ agency_get_agency: { agency }, agency_update_agency: { id: "270e07b7-agency" } });
    renderPage(<ProfileView />, "profile", "", filled);
    await screen.findByRole("textbox", { name: "Name" });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText(/^Last saved \d/);
    expect(callsOf("agency_update_agency")).toEqual([{ name: "Siaya Farmers' Group", description: "Farmers of Siaya who grow crops and keep animals." }]);
  });
});

describe("the Save changes button on the profile page", () => {
  it("stays still while nothing is edited and flashes once a field differs from the saved one", async () => {
    const user = userEvent.setup();
    await open();
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).not.toHaveClass("flash");

    await user.type(screen.getByRole("textbox", { name: "Purpose" }), " and animals");

    expect(save).toHaveClass("flash");
  });

  it("flashes when the chat has filled a field", async () => {
    answerWith({ agency_get_agency: { agency } });
    renderPage(<ProfileView />, "profile", "", { chatFill: { form: "profile", fill: { name: "", purpose: "Crops and animals." } } });
    await screen.findByRole("textbox", { name: "Name" });

    expect(screen.getByRole("button", { name: "Save changes" })).toHaveClass("flash");
  });
});

describe("saving the profile", () => {
  it("saves the new name and purpose for the draft and shows when it was last saved, without a status line", async () => {
    const user = userEvent.setup();
    await open();
    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Siaya Farmers' Cooperative");
    await user.clear(screen.getByRole("textbox", { name: "Purpose" }));
    await user.type(screen.getByRole("textbox", { name: "Purpose" }), "Grow together");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText(/^Last saved \d/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(callsOf("agency_update_agency")).toEqual([{ name: "Siaya Farmers' Cooperative", description: "Grow together" }]);
  });

  it("asks for nothing when nothing was changed", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(callsOf("agency_update_agency")).toEqual([]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("asks for a name and sends nothing when the name is emptied", async () => {
    const user = userEvent.setup();
    await open();
    await user.clear(screen.getByRole("textbox", { name: "Name" }));

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: Name");
    expect(callsOf("agency_update_agency")).toEqual([]);
  });

  it("counts a name of spaces as missing", async () => {
    const user = userEvent.setup();
    await open();
    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "   ");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Required: Name");
    expect(callsOf("agency_update_agency")).toEqual([]);
  });

  it("says the change could not be sent in the error style and keeps what was typed when the update fails", async () => {
    const user = userEvent.setup();
    answerWith({
      agency_get_agency: { agency },
      agency_update_agency: () => {
        throw new Error("offline");
      },
    });
    renderPage(<ProfileView />, "profile");
    await user.type(await screen.findByRole("textbox", { name: "Purpose" }), " More.");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const note = await screen.findByText("The change could not be sent.");
    expect(note).toHaveClass("error");
    expect(note).toHaveAttribute("role", "status");
    expect(screen.getByRole("textbox", { name: "Purpose" })).toHaveValue("Farmers who pool their input orders. More.");
  });
});

describe("autosave on the profile page", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is off at first and the choice is kept in the browser", async () => {
    const user = userEvent.setup();
    await open();
    const toggle = screen.getByRole("switch", { name: "Autosave" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(localStorage.getItem("autosave")).toBe("on");
  });

  it("starts on when the browser remembers it was turned on", async () => {
    localStorage.setItem("autosave", "on");
    await open();

    expect(screen.getByRole("switch", { name: "Autosave" })).toBeChecked();
  });

  it("saves an edit by itself once typing stops, and only once", async () => {
    localStorage.setItem("autosave", "on");
    const user = userEvent.setup();
    await open();

    await user.type(screen.getByRole("textbox", { name: "Purpose" }), " and animals");

    await screen.findByText(/^Last saved \d/, {}, { timeout: 3000 });
    expect(callsOf("agency_update_agency")).toEqual([{ name: "Siaya Farmers' Group", description: "Farmers who pool their input orders. and animals" }]);
    await new Promise((done) => setTimeout(done, 1500));
    expect(callsOf("agency_update_agency")).toHaveLength(1);
  });

  it("saves the Purpose the chat filled in by itself, with no press on Save", async () => {
    localStorage.setItem("autosave", "on");
    answerWith({ agency_get_agency: { agency }, agency_update_agency: { id: "270e07b7-agency" } });
    renderPage(<ProfileView />, "profile", "", { chatFill: { form: "profile", fill: { name: "", purpose: "Crops, animals, vets, transporters and financiers." } } });
    await screen.findByRole("textbox", { name: "Name" });

    await screen.findByText(/^Last saved \d/, {}, { timeout: 3000 });

    expect(callsOf("agency_update_agency")).toEqual([{ name: "Siaya Farmers' Group", description: "Crops, animals, vets, transporters and financiers." }]);
  });

  it("saves the Purpose the chat fills in while the page is already open", async () => {
    localStorage.setItem("autosave", "on");
    const user = userEvent.setup();
    answerWith({ agency_get_agency: { agency }, agency_update_agency: { id: "270e07b7-agency" } });
    const Chat = () => {
      const navigate = useNavigate();
      const { pathname } = useLocation();
      const fill = { chatFill: { form: "profile", fill: { name: "", purpose: "Crops, animals, vets, transporters and financiers." } } };
      return <button onClick={() => navigate(pathname, { state: fill })}>Chat fills</button>;
    };
    renderPage(
      <>
        <ProfileView />
        <Chat />
      </>,
      "profile",
    );
    await screen.findByRole("textbox", { name: "Name" });

    await user.click(screen.getByRole("button", { name: "Chat fills" }));

    await screen.findByText(/^Last saved \d/, {}, { timeout: 3000 });
    expect(callsOf("agency_update_agency")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Purpose" })).toHaveValue("Crops, animals, vets, transporters and financiers.");
  });

  it("hides the Save changes button while autosave is on and brings it back when it is off", async () => {
    const user = userEvent.setup();
    await open();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Autosave" }));
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Autosave" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("does not try again by itself after a save failed, until the text is edited", async () => {
    localStorage.setItem("autosave", "on");
    const user = userEvent.setup();
    answerWith({
      agency_get_agency: { agency },
      agency_update_agency: () => {
        throw new Error("offline");
      },
    });
    renderPage(<ProfileView />, "profile");
    await user.type(await screen.findByRole("textbox", { name: "Purpose" }), " More.");

    await screen.findByText("The change could not be sent.", {}, { timeout: 3000 });
    await new Promise((done) => setTimeout(done, 2800));

    expect(callsOf("agency_update_agency")).toHaveLength(1);
  });

  it("saves what was typed while an earlier save was still on its way", async () => {
    localStorage.setItem("autosave", "on");
    const user = userEvent.setup();
    let release: () => void = () => {};
    answerWith({
      agency_get_agency: { agency },
      agency_update_agency: () => new Promise<unknown>((done) => (release = () => done({ id: "x" }))),
    });
    renderPage(<ProfileView />, "profile");
    await user.type(await screen.findByRole("textbox", { name: "Purpose" }), " One");
    await screen.findByText("Saving…", {}, { timeout: 3000 });

    await user.type(screen.getByRole("textbox", { name: "Purpose" }), " Two");
    release();

    await vi.waitFor(() => expect(callsOf("agency_update_agency")).toHaveLength(2), { timeout: 4000 });
    expect(callsOf("agency_update_agency")[1]).toEqual({ name: "Siaya Farmers' Group", description: "Farmers who pool their input orders. One Two" });
  });

  it("saves nothing by itself while autosave is off", async () => {
    const user = userEvent.setup();
    await open();

    await user.type(screen.getByRole("textbox", { name: "Purpose" }), " and animals");
    await new Promise((done) => setTimeout(done, 1500));

    expect(callsOf("agency_update_agency")).toEqual([]);
  });
});
