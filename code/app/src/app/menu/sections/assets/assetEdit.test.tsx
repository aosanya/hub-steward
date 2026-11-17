import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { items, routes } from "./index";
import { answerActors, keeperChoiceNames } from "./keeperActors";

let called: MockInstance<typeof mcp.callTool>;
let permissions: string[];
let roller: Record<string, string>;

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  const actors = answerActors(name, args);
  if (actors) return actors;
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
  describe("the keeper of an asset", () => {
    const kept = '{"condition":"Fair","warranty":"2027","keeper":"p2"}';

    const updates = () => called.mock.calls.filter(([, name]) => name === "assetmanager_asset_update");

    const sentArgs = () => updates()[0][2] as Record<string, unknown>;

    const sentAttributes = () => JSON.parse(sentArgs().attributes_json as string);

    const keptBy = () => (screen.queryByText("Kept by", { selector: ".ttl" })?.closest(".row")?.querySelector(".meta")?.textContent ?? null);

    const settled = async () => {
      await screen.findByText("A-12");
      await waitFor(() => expect(called.mock.calls.some(([, name]) => String(name).startsWith("actor_"))).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 20));
    };

    const openChoice = async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      return screen.findByRole("group", { name: "Kept by" });
    };

    const save = () => userEvent.click(screen.getByRole("button", { name: "Save" }));

    it("shows the name of a person who keeps the asset, after Condition, and never the id", async () => {
      roller.attributes_json = kept;
      await openRoller();

      await waitFor(() => expect(keptBy()).toBe("Gábor Horváth"));
      const condition = screen.getByText("Condition", { selector: ".ttl" });
      const keeper = screen.getByText("Kept by", { selector: ".ttl" });
      expect(Boolean(condition.compareDocumentPosition(keeper) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
      expect(screen.queryByText("p2")).toBeNull();
      expect(screen.queryByText("warranty")).toBeNull();
    });

    it("shows the name of a group that keeps the asset", async () => {
      roller.attributes_json = '{"keeper":"g2"}';
      await openRoller();

      await waitFor(() => expect(keptBy()).toBe("Road Repair Crew"));
    });

    it.each([
      ["has no keeper", '{"condition":"Fair"}'],
      ["has a keeper that is not text", '{"keeper":7}'],
      ["has a keeper id that is nobody", '{"keeper":"zz9"}'],
      ["has an empty keeper", '{"keeper":""}'],
    ])("shows no Kept by row when the asset %s", async (_case, attributes) => {
      roller.attributes_json = attributes;
      await openRoller();

      await settled();
      expect(screen.queryByText("Kept by")).toBeNull();
    });

    it("offers every person and group of the hub by name as radios in a Kept by group, with the current keeper chosen", async () => {
      roller.attributes_json = kept;
      await openRoller();

      const group = await openChoice();
      const radios = within(group).getAllByRole("radio");

      expect(radios.map((radio) => radio.closest("label")?.textContent).sort()).toEqual([...keeperChoiceNames].sort());
      expect(radios.filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1);
      expect(within(group).getByRole("radio", { name: "Gábor Horváth" })).toBeChecked();
      expect(within(group).getByRole("radio", { name: "Road Repair Crew" })).not.toBeChecked();
    });

    it("saves another person as the keeper with the whole record and shows the new name", async () => {
      roller.attributes_json = kept;
      roller.serial_tag = "SN-4471";
      roller.updated_at = "2026-11-01T08:00:00Z";
      await openRoller();

      const group = await openChoice();
      await userEvent.click(within(group).getByRole("radio", { name: "Nagy Réka" }));
      await save();

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(Object.keys(sentArgs()).sort()).toEqual(["assetID", "attributes_json", "category", "name", "serial_tag", "version"]);
      expect(sentArgs()).toMatchObject({ assetID: "e1", name: "Road roller", category: "Equipment", serial_tag: "SN-4471", version: "2026-11-01T08:00:00Z" });
      expect(sentAttributes()).toEqual({ condition: "Fair", warranty: "2027", keeper: "p1" });
      await waitFor(() => expect(keptBy()).toBe("Nagy Réka"));
      expect(screen.queryByText("Gábor Horváth")).toBeNull();
    });

    it("saves a group as the keeper and shows its name", async () => {
      roller.attributes_json = kept;
      await openRoller();

      const group = await openChoice();
      await userEvent.click(within(group).getByRole("radio", { name: "Street Lighting Crew" }));
      await save();

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(sentAttributes()).toEqual({ condition: "Fair", warranty: "2027", keeper: "g1" });
      await waitFor(() => expect(keptBy()).toBe("Street Lighting Crew"));
    });

    it("tells two people of the same name apart", async () => {
      roller.attributes_json = '{"keeper":"p3"}';
      await openRoller();

      const group = await openChoice();
      const twins = within(group).getAllByRole("radio", { name: "Tóth Márton" }) as HTMLInputElement[];
      expect(twins).toHaveLength(2);
      expect(twins.filter((twin) => twin.checked)).toHaveLength(1);

      const other = twins.find((twin) => !twin.checked) as HTMLInputElement;
      const current = twins.find((twin) => twin.checked) as HTMLInputElement;
      await userEvent.click(other);
      expect(other).toBeChecked();
      expect(current).not.toBeChecked();
      await save();

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(sentAttributes()).toEqual({ keeper: "p4" });
      await waitFor(() => expect(keptBy()).toBe("Tóth Márton"));
    });

    it("sets a keeper on an asset that had no attributes", async () => {
      await openRoller();

      const group = await openChoice();
      expect(within(group).getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(0);
      await userEvent.click(within(group).getByRole("radio", { name: "Public Works Department" }));
      await save();

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(sentAttributes()).toEqual({ keeper: "g3" });
      await waitFor(() => expect(keptBy()).toBe("Public Works Department"));
    });

    it("saves a new condition and a new keeper together and keeps every other key", async () => {
      roller.attributes_json = kept;
      await openRoller();

      const group = await openChoice();
      await userEvent.click(within(group).getByRole("radio", { name: "Road Repair Crew" }));
      await userEvent.click(screen.getByRole("radio", { name: "Poor" }));
      await save();

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(sentAttributes()).toEqual({ condition: "Poor", warranty: "2027", keeper: "g2" });
    });

    it("keeps the keeper and the original attributes text when only the name changes", async () => {
      roller.attributes_json = kept;
      await openRoller();

      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      const name = screen.getByLabelText("Name");
      await userEvent.clear(name);
      await userEvent.type(name, "Heavy roller");
      await save();

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(updates()[0][2]).toEqual({ assetID: "e1", name: "Heavy roller", category: "Equipment", attributes_json: kept });
    });

    it("shows nobody chosen and keeps the unknown id when the keeper is nobody and only the name changes", async () => {
      roller.attributes_json = '{"keeper":"zz9","warranty":"2027"}';
      await openRoller();

      const group = await openChoice();
      expect(within(group).getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(0);
      const name = screen.getByLabelText("Name");
      await userEvent.clear(name);
      await userEvent.type(name, "Heavy roller");
      await save();

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(sentAttributes()).toEqual({ keeper: "zz9", warranty: "2027" });
    });

    it("offers no Kept by choice and sends the raw text back when the attributes are not JSON", async () => {
      roller.attributes_json = "not json";
      await openRoller();

      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      expect(screen.queryByRole("group", { name: "Kept by" })).toBeNull();
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
      const name = screen.getByLabelText("Name");
      await userEvent.clear(name);
      await userEvent.type(name, "Heavy roller");
      await save();

      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(updates()[0][2]).toEqual({ assetID: "e1", name: "Heavy roller", category: "Equipment", attributes_json: "not json" });
    });

    it("shows the keeper but no Edit and no choice to a caller without asset.manage", async () => {
      permissions = ["asset.view"];
      roller.attributes_json = kept;
      await openRoller();

      await waitFor(() => expect(keptBy()).toBe("Gábor Horváth"));
      await waitFor(() => expect(called).toHaveBeenCalledWith("", "agency_get_my_roles"));

      expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
      expect(screen.queryByRole("group", { name: "Kept by" })).toBeNull();
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
    });

    describe("on a wide screen", () => {
      beforeEach(() => setWide(true));

      afterEach(() => forgetWidth());

      it("shows the Kept by row in the right pane", async () => {
        roller.attributes_json = kept;
        await openRoller();

        const main = document.querySelector(".wf-main") as HTMLElement;
        expect(await within(main).findByText("Kept by")).toBeInTheDocument();
        expect(await within(main).findByText("Gábor Horváth")).toBeInTheDocument();
      });

      it("saves a new keeper and shows the new name in the right pane", async () => {
        roller.attributes_json = kept;
        await openRoller();

        const group = await openChoice();
        await userEvent.click(within(group).getByRole("radio", { name: "Street Lighting Crew" }));
        await save();

        await waitFor(() => expect(updates()).toHaveLength(1));
        expect(sentAttributes()).toEqual({ condition: "Fair", warranty: "2027", keeper: "g1" });
        const main = document.querySelector(".wf-main") as HTMLElement;
        expect(await within(main).findByText("Street Lighting Crew")).toBeInTheDocument();
      });
    });
  });
});
