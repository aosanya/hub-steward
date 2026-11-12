import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { callTool } from "../../wakala/mcp";
import { currentAddress } from "../models/locationSpy";
import { renderConsentAt, settle } from "./consentTesting";

vi.mock("../../wakala/mcp");

const inForce = { version: "v3", clauses: [{ key: "consent", text: "We keep your answers for three years." }] };

const serve = (publish: (args: Record<string, unknown>) => unknown, held: unknown = inForce) => {
  vi.mocked(callTool).mockReset();
  vi.mocked(callTool).mockImplementation(async (_hub, tool, args = {}) => {
    if (tool === "custody_get_in_force_consent") {
      if (held instanceof Error) throw held;
      return held;
    }
    if (tool === "custody_publish_consent_version") return publish(args);
    if (tool === "custody_list_consent_versions") return { items: [{ id: "c4", version: "v4", published_at: "2026-11-12T10:00:00Z", in_force: true }] };
    return {};
  });
};

const open = async (publish: (args: Record<string, unknown>) => unknown = () => ({ version: "v4" }), held?: unknown) => {
  serve(publish, held);
  renderConsentAt("/h/h1/consent/new");
  await settle();
};

const box = () => screen.getByRole("textbox", { name: /Consent text/ });
const publish = () => userEvent.click(screen.getByRole("button", { name: "Publish" }));
const publishCalls = () => vi.mocked(callTool).mock.calls.filter((call) => call[1] === "custody_publish_consent_version");

describe("the New version form of the consent text", () => {
  it("has one required text box prefilled with the text in force, and Publish and Cancel", async () => {
    await open();
    expect(callTool).toHaveBeenCalledWith("h1", "custody_get_in_force_consent");
    expect(box()).toHaveValue("We keep your answers for three years.");
    expect(box()).toBeRequired();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("starts empty before anything has been published", async () => {
    await open(undefined, new Error("not found"));
    expect(box()).toHaveValue("");
  });

  it("publishes the edited text, returns to the table and says Published as version 4", async () => {
    await open();
    await userEvent.clear(box());
    await userEvent.type(box(), "We keep your answers for one year.");
    await publish();
    await settle();
    expect(publishCalls().map((call) => call[2])).toEqual([{ text: "We keep your answers for one year." }]);
    expect(currentAddress()).toBe("/h/h1/consent");
    expect(screen.getByRole("status")).toHaveTextContent("Published as version 4");
    expect(screen.getByText("Version 4")).toBeInTheDocument();
    expect(screen.getByText("In force")).toBeInTheDocument();
  });

  it("refuses an empty text without calling the tool", async () => {
    await open();
    await userEvent.clear(box());
    await publish();
    await settle();
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(publishCalls()).toHaveLength(0);
    expect(currentAddress()).toBe("/h/h1/consent/new");
  });

  it("stays on the form with a notice when the tool refuses", async () => {
    await open(() => {
      throw new Error("text is longer than 2000 characters");
    });
    await publish();
    await settle();
    expect(currentAddress()).toBe("/h/h1/consent/new");
    expect(screen.getByRole("alert")).toHaveTextContent("The change could not be sent.");
    expect(box()).toHaveValue("We keep your answers for three years.");
  });

  it("goes back to the table on Cancel and publishes nothing", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await settle();
    expect(currentAddress()).toBe("/h/h1/consent");
    expect(publishCalls()).toHaveLength(0);
  });
});
