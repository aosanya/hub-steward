import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { settingReply, settingsOf, type Settings } from "../../settingsFake";
import { routes } from "./index";
import { placePaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

type Item = Record<string, unknown>;

let settings: Settings;
let permissions: string[];
let tenures: Item[];
let called: MockInstance<typeof mcp.callTool>;
let landed = "";

const Where = () => {
  const here = useLocation();
  landed = `${here.pathname}${here.search}`;
  return null;
};

const waterMeter = { prompt: "Water meter number", on: true, required: true, own: true };

const holdingChoice = (...details: Item[]) => ({ "register_details:HOLDING": { details } });

const hub = () =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const given = (args ?? {}) as Record<string, unknown>;
    const setting = settingReply(settings, tool, args);
    if (setting !== undefined) return setting;
    if (tool === "agency_list_mounts") return { modules: [{ module: "digitaltwin" }] };
    if (tool === "agency_get_my_roles") return { permissions };
    if (tool === "actor_list_actors") return { items: [{ id: "a1", display_name: "Varga Mária" }] };
    if (tool === "digitaltwin_node_list") return { items: [{ id: "n1", name: "Kossuth utca 7" }, { id: "n2", name: "Malom utca 4" }] };
    if (tool === "digitaltwin_tenure_list") return { items: tenures };
    if (tool === "digitaltwin_tenure_read") return { item: tenures.find((tenure) => tenure.id === given.tenureID) };
    if (tool === "digitaltwin_tenure_create") {
      const made = { id: "t9", ...given };
      tenures = [...tenures, made];
      return { item: made };
    }
    return { items: [] };
  });

const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

const chooseHolder = async (user: ReturnType<typeof userEvent.setup>, name = "Varga Mária") => {
  await user.click(await screen.findByRole("button", { name: /Holder/ }));
  await user.click(screen.getByRole("option", { name }));
};

const chooseProperty = async (user: ReturnType<typeof userEvent.setup>, name = "Malom utca 4") => {
  await user.click(await screen.findByRole("button", { name: /Property/ }));
  await user.click(screen.getByRole("option", { name }));
};

const createCalls = () => called.mock.calls.filter(([, tool]) => tool === "digitaltwin_tenure_create");

beforeEach(() => {
  openAgency("zoldhalom");
  setWide(true);
  settings = {};
  permissions = ["digitaltwin.manage"];
  tenures = [{ id: "t1", place_id: "n1", holder: "Szabó Katalin", kind: "owner", since: "2019-03-01T00:00:00Z" }];
  called = hub();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe("the Add holding form on Ownership & Tenure", () => {
  it("shows an Add holding button to a person holding digitaltwin.manage", async () => {
    show(placePaths.ownership.path());

    await screen.findByText("Szabó Katalin", { selector: ".ttl" });
    const button = await screen.findByRole("button", { name: "Add holding" });
    expect(button.compareDocumentPosition(await screen.findByLabelText("Search")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no Add holding button to a person without that permission", async () => {
    permissions = ["digitaltwin.view"];
    show(placePaths.ownership.path());

    await screen.findByText("Szabó Katalin", { selector: ".ttl" });
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));
    expect(screen.queryByRole("button", { name: "Add holding" })).toBeNull();
  });

  it("leads from the button to the form", async () => {
    const user = userEvent.setup();
    show(placePaths.ownership.path());

    await user.click(await screen.findByRole("button", { name: "Add holding" }));

    expect(landed).toBe(placePaths.holdingNew.path());
    expect(await screen.findByRole("button", { name: /Holder/ })).toBeInTheDocument();
  });

  it("saves the holder, property, kind and since through digitaltwin_tenure_create and keeps the own detail answer under the new holding", async () => {
    const user = userEvent.setup();
    settings = settingsOf(holdingChoice(waterMeter));
    show(placePaths.holdingNew.path());

    await chooseHolder(user);
    await user.click(await screen.findByRole("button", { name: /Property/ }));
    await user.click(screen.getByRole("option", { name: "Malom utca 4" }));
    await user.click(screen.getByRole("radio", { name: "tenant" }));
    await user.type(screen.getByLabelText("Since (optional)"), "2024-05-01");
    await user.type(screen.getByLabelText("Water meter number"), "WM-4412");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0][2]).toEqual({ holder: "Varga Mária", holder_actor_id: "a1", place_id: "n2", kind: "tenant", since: "2024-05-01T00:00:00Z" });
    await waitFor(() => expect(JSON.parse(settings["register_answers:HOLDING:t9"]).answers).toEqual({ "Water meter number": "WM-4412" }));
  });

  it("lands on the list with the new holding opened", async () => {
    const user = userEvent.setup();
    show(placePaths.holdingNew.path());

    await chooseHolder(user);
    await chooseProperty(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(landed).toBe(placePaths.ownership.path({ holding: "t9" })));
    expect(await screen.findByText("Varga Mária", { selector: ".ttl" })).toBeInTheDocument();
  });

  it("asks only the switched-on holding details", async () => {
    settings = settingsOf(holdingChoice({ prompt: "Since", on: false, required: false, own: false }));
    show(placePaths.holdingNew.path());

    await screen.findByRole("button", { name: /Holder/ });
    await waitFor(() => expect(screen.queryByLabelText(/^Since/)).toBeNull());
    expect(screen.getByRole("button", { name: /Property/ })).toBeInTheDocument();
  });

  it("does not let the form go while a required own detail is unanswered", async () => {
    const user = userEvent.setup();
    settings = settingsOf(holdingChoice(waterMeter));
    show(placePaths.holdingNew.path());

    await chooseHolder(user);
    await screen.findByLabelText("Water meter number");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(createCalls()).toHaveLength(0);
  });

  it("asks the property even when settings had switched the Property detail off", async () => {
    settings = settingsOf(holdingChoice({ prompt: "Property", on: false, required: false, own: false }));
    show(placePaths.holdingNew.path());

    await screen.findByRole("button", { name: /Holder/ });

    expect(await screen.findByRole("button", { name: /Property/ })).toBeInTheDocument();
    expect(screen.queryByText("Property (optional)")).toBeNull();
  });

  it("keeps Save disabled until a property is chosen and then sends its place_id", async () => {
    const user = userEvent.setup();
    settings = settingsOf(holdingChoice({ prompt: "Property", on: false, required: false, own: false }));
    show(placePaths.holdingNew.path());

    await chooseHolder(user);
    await screen.findByRole("button", { name: /Property/ });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(createCalls()).toHaveLength(0);

    await chooseProperty(user, "Kossuth utca 7");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0][2]).toEqual({ holder: "Varga Mária", holder_actor_id: "a1", place_id: "n1" });
  });

  it("shows the hub's refusal and keeps what was typed", async () => {
    const user = userEvent.setup();
    called.mockImplementation(async (_hub, tool, args) => {
      if (tool === "digitaltwin_tenure_create") throw new mcp.McpError("digitaltwin_tenure_create: place not found");
      if (tool === "actor_list_actors") return { items: [{ id: "a1", display_name: "Varga Mária" }] };
      if (tool === "digitaltwin_node_list") return { items: [{ id: "n2", name: "Malom utca 4" }] };
      return settingReply(settings, tool, args) ?? { items: [] };
    });
    show(placePaths.holdingNew.path());

    await chooseHolder(user);
    await chooseProperty(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("place not found");
    expect(screen.getByRole("button", { name: /Holder/ })).toHaveTextContent("Varga Mária");
    expect(landed).toBe(placePaths.holdingNew.path());
  });
});
