import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { settingReply } from "../../settingsFake";
import { routes } from "./index";
import { placePaths } from "./paths";

vi.mock("../../../../features/inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

let called: MockInstance<typeof mcp.callTool>;

const hub = () =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub, tool, args) => {
    const setting = settingReply({}, tool, args);
    if (setting !== undefined) return setting;
    if (tool === "agency_list_mounts") return { modules: [{ module: "digitaltwin" }] };
    if (tool === "agency_get_my_roles") return { permissions: ["digitaltwin.manage"] };
    if (tool === "actor_list_groups") return { items: [{ id: "g1", name: "Zöldhalom Town Council" }, { id: "g2", name: "Zöldhalom Parish" }] };
    if (tool === "actor_list_actors") return { items: [{ id: "a1", display_name: "Varga Mária" }, { id: "a2", display_name: "Szabó Katalin" }] };
    if (tool === "assetmanager_asset_list") {
      return {
        items: [
          { id: "p1", name: "Malom utca 4", category: "Building", attributes_json: JSON.stringify({ place_id: "n2" }) },
          { id: "p2", name: "Rét dűlő parcel", category: "Parcel", attributes_json: JSON.stringify({ place_id: "n3" }) },
          { id: "p3", name: "Delivery van", category: "Vehicle", attributes_json: "{}" },
        ],
      };
    }
    if (tool === "digitaltwin_node_list") return { items: [] };
    if (tool === "digitaltwin_tenure_create") return { item: { id: "t9", ...(args as object) } };
    return { items: [] };
  });

const show = () =>
  render(
    <MemoryRouter initialEntries={[placePaths.holdingNew.path()]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency("zoldhalom");
  setWide(true);
  called = hub();
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

describe("Add holding looks its references up", () => {
  it("offers the Holder from the registry of people", async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole("button", { name: /Holder/ }));

    expect(screen.getByRole("option", { name: "Varga Mária" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Szabó Katalin" })).toBeInTheDocument();
  });

  it("offers the Property from the properties list even when the digital twin holds no nodes", async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole("button", { name: /Property/ }));

    expect(screen.getByRole("option", { name: /Malom utca 4/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Rét dűlő parcel/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Delivery van/ })).toBeNull();
  });

  it("saves the chosen person's name and the chosen property's place", async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole("button", { name: /Holder/ }));
    await user.click(screen.getByRole("option", { name: "Varga Mária" }));
    await user.click(await screen.findByRole("button", { name: /Property/ }));
    await user.click(screen.getByRole("option", { name: /Malom utca 4/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const created = () => called.mock.calls.filter(([, tool]) => tool === "digitaltwin_tenure_create");
    await waitFor(() => expect(created()).toHaveLength(1));
    expect(created()[0][2]).toEqual({ holder: "Varga Mária", holder_actor_id: "a1", place_id: "n2" });
  });

  it("offers the council and the parish as holders and saves a body by name alone", async () => {
    const user = userEvent.setup();
    show();

    await user.click(await screen.findByRole("button", { name: /Holder/ }));
    expect(screen.getByRole("option", { name: "Zöldhalom Parish" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Zöldhalom Town Council" }));
    await user.click(await screen.findByRole("button", { name: /Property/ }));
    await user.click(screen.getByRole("option", { name: /Malom utca 4/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const created = () => called.mock.calls.filter(([, tool]) => tool === "digitaltwin_tenure_create");
    await waitFor(() => expect(created()).toHaveLength(1));
    expect(created()[0][2]).toEqual({ holder: "Zöldhalom Town Council", place_id: "n2" });
  });
});
