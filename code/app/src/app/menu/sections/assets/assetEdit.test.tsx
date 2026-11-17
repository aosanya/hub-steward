import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let roller: Record<string, string>;

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  if (name === "agency_list_mounts") return { modules: [{ module: "assetmanager" }] };
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "assetmanager_asset_list") return { items: [roller] };
  if (name === "assetmanager_asset_read") return { item: roller };
  if (name === "assetmanager_location_list") return { items: [] };
  if (name === "assetmanager_movement_list") return { items: [] };
  if (name === "assetmanager_asset_update") {
    roller = { ...roller, ...given };
    return {};
  }
  throw new Error(`${name}: unknown tool`);
};

beforeEach(() => {
  openAgency("town");
  permissions = ["asset.manage"];
  roller = { id: "e1", code: "A-12", name: "Road roller", category: "Equipment" };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  vi.restoreAllMocks();
});

const openRoller = async () => {
  const path = items.find((item) => item.title === "Equipment")?.path?.() ?? "";
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes()}</Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole("button", { name: /Road roller/ }));
};

describe("editing an asset from its detail", () => {
  it("lets a caller with asset.manage rename it and shows the new name", async () => {
    await openRoller();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Heavy roller");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith("", "assetmanager_asset_update", { assetID: "e1", name: "Heavy roller", category: "Equipment" }));
    expect((await screen.findAllByText("Heavy roller")).length).toBeGreaterThan(1);
  });

  it("shows no Edit to a caller without asset.manage", async () => {
    permissions = ["asset.view"];
    await openRoller();

    await screen.findByText("A-12");
    await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  describe("the condition of an asset", () => {
    const original = '{"condition":"Fair","warranty":"2027"}';

    const updates = () => called.mock.calls.filter(([, name]) => name === "assetmanager_asset_update");

    const sentAttributes = () => JSON.parse((updates()[0][2] as Record<string, string>).attributes_json);

    const rename = async (to: string) => {
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      const name = screen.getByLabelText("Name");
      await userEvent.clear(name);
      await userEvent.type(name, to);
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
    };

    it("shows the condition in the detail and none of the other attributes", async () => {
      roller.attributes_json = original;
      await openRoller();

      expect(await screen.findByText("Condition")).toBeInTheDocument();
      expect(screen.getByText("Fair")).toBeInTheDocument();
      expect(screen.queryByText("warranty")).toBeNull();
      expect(screen.queryByText("2027")).toBeNull();
    });

    it.each([
      ["has no attributes", undefined],
      ["has an empty object", "{}"],
      ["has text that is not JSON", "not json"],
      ["has a JSON array", "[1]"],
    ])("shows no Condition row when the asset %s", async (_case, attributes) => {
      if (attributes !== undefined) roller.attributes_json = attributes;
      await openRoller();

      await screen.findByText("A-12");
      expect(screen.queryByText("Condition")).toBeNull();
    });

    it("offers the four conditions as radios in a Condition group, with the current one chosen", async () => {
      roller.attributes_json = original;
      await openRoller();

      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      const group = screen.getByRole("group", { name: "Condition" });

      expect(within(group).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual(["Good", "Fair", "Poor", "Out of use"]);
      expect(within(group).getByRole("radio", { name: "Fair" })).toBeChecked();
      expect(within(group).getByRole("radio", { name: "Poor" })).not.toBeChecked();
    });

    it("saves a chosen condition with the whole record and shows it afterwards", async () => {
      roller.attributes_json = original;
      await openRoller();

      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      await userEvent.click(screen.getByRole("radio", { name: "Poor" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(updates()).toHaveLength(1));
      const args = updates()[0][2] as Record<string, unknown>;
      expect(Object.keys(args).sort()).toEqual(["assetID", "attributes_json", "category", "name"]);
      expect(args).toMatchObject({ assetID: "e1", name: "Road roller", category: "Equipment" });
      expect(typeof args.attributes_json).toBe("string");
      expect(sentAttributes()).toEqual({ condition: "Poor", warranty: "2027" });
      expect(await screen.findByText("Poor")).toBeInTheDocument();
      expect(screen.queryByText("Fair")).toBeNull();
    });

    it("sets a condition on an asset that had no attributes", async () => {
      await openRoller();

      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      await userEvent.click(screen.getByRole("radio", { name: "Good" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(sentAttributes()).toEqual({ condition: "Good" });
    });

    it("sends the original attributes text back unchanged when only the name changes", async () => {
      roller.attributes_json = original;
      await openRoller();

      await rename("Heavy roller");

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(updates()[0][2]).toEqual({ assetID: "e1", name: "Heavy roller", category: "Equipment", attributes_json: original });
    });

    it("offers no Condition choice and sends the raw text back when the attributes are not JSON", async () => {
      roller.attributes_json = "not json";
      await openRoller();

      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      expect(screen.queryByRole("group", { name: "Condition" })).toBeNull();
      expect(screen.queryAllByRole("radio")).toHaveLength(0);

      const name = screen.getByLabelText("Name");
      await userEvent.clear(name);
      await userEvent.type(name, "Heavy roller");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(updates()[0][2]).toEqual({ assetID: "e1", name: "Heavy roller", category: "Equipment", attributes_json: "not json" });
    });

    it("sends the serial tag and the version the asset carries", async () => {
      roller.serial_tag = "SN-4471";
      roller.updated_at = "2026-11-01T08:00:00Z";
      roller.attributes_json = original;
      await openRoller();

      await rename("Heavy roller");

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(updates()[0][2]).toEqual({
        assetID: "e1",
        name: "Heavy roller",
        category: "Equipment",
        serial_tag: "SN-4471",
        attributes_json: original,
        version: "2026-11-01T08:00:00Z",
      });
    });

    it("leaves serial_tag and version out when the asset has neither", async () => {
      roller.attributes_json = original;
      await openRoller();

      await rename("Heavy roller");

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(updates()[0][2]).not.toHaveProperty("serial_tag");
      expect(updates()[0][2]).not.toHaveProperty("version");
    });

    it("shows the condition but no Edit and no radios to a caller without asset.manage", async () => {
      permissions = ["asset.view"];
      roller.attributes_json = original;
      await openRoller();

      expect(await screen.findByText("Condition")).toBeInTheDocument();
      expect(screen.getByText("Fair")).toBeInTheDocument();
      await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

      expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
    });

    describe("on a wide screen", () => {
      beforeEach(() => setWide(true));

      afterEach(() => forgetWidth());

      it("shows the Condition row in the right pane", async () => {
        roller.attributes_json = original;
        await openRoller();

        const main = document.querySelector(".wf-main") as HTMLElement;
        expect(await within(main).findByText("Condition")).toBeInTheDocument();
        expect(within(main).getByText("Fair")).toBeInTheDocument();
      });
    });
  });
});
