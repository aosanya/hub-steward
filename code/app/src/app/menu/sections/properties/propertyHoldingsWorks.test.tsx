import { vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, useLocation } from "react-router-dom";
import { forgetWidth, setWide } from "../../../../features/inbox/fakeWidth";
import { forgetOpenAgency, openAgency } from "../../../../shared/wakala/openAgency";
import * as mcp from "../../../../shared/wakala/mcp";
import { routes } from "./index";
import { placePaths } from "./paths";
import * as records from "./records";

const tenureList = "digitaltwin_tenure_list";
const tenureRead = "digitaltwin_tenure_read";
const taskList = "taskmanager_task_list";

const mounted = { modules: [{ module: "digitaltwin" }, { module: "assetmanager" }, { module: "taskmanager" }] };

const library = { id: "a1", name: "Zoldhalom Library", category: "Building", location_id: "l1", attributes_json: JSON.stringify({ place_id: "n1", parcel_number: "0412/7" }) };
const unlinked = { id: "a2", name: "Zoldhalom Market Hall", category: "Building", location_id: "l1", attributes_json: JSON.stringify({ parcel_number: "0413/2" }) };

const tenure = { id: "t1", place_id: "n1", holder: "Bela Szabo", kind: "owner", since: "2019-03-01T00:00:00Z" };
const otherTenure = { id: "t2", place_id: "n2", holder: "Anna Kovacs", kind: "custodian", since: "2021-05-04T00:00:00Z" };

const tasks = [
  { id: "w1", title: "Repaint the reading room", state: "open", due_at: "2026-11-20T00:00:00Z", linked_ref: "a1" },
  { id: "w2", title: "Replace the gutter", state: "done", completed_at: "2026-10-02T00:00:00Z", linked_ref: "a1" },
  { id: "w3", title: "Mow the common", state: "open", due_at: "2026-11-25T00:00:00Z", linked_ref: "a9" },
  { id: "w4", title: "Order new chairs", state: "open", linked_ref: "" },
];

let called: MockInstance<typeof mcp.callTool>;
let landed: { pathname: string; state: unknown };
let permissions: string[];
let asset: Record<string, unknown>;
let listed: Record<string, unknown>[];

const Where = () => {
  const here = useLocation();
  landed = { pathname: here.pathname, state: here.state };
  return null;
};

const answer = async (name: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, unknown>;
  if (name === "agency_list_mounts") return mounted;
  if (name === "agency_get_my_roles") return { permissions };
  if (name === "assetmanager_asset_list") return { items: listed };
  if (name === "assetmanager_asset_read") return { item: given.assetID === "a2" ? unlinked : asset };
  if (name === "assetmanager_location_read") return { item: { id: "l1", name: "Kossuth utca 7" } };
  if (name === "assetmanager_asset_update") return {};
  if (name === tenureList) return { items: [tenure, otherTenure].filter((row) => given.place_id === undefined || row.place_id === given.place_id) };
  if (name === tenureRead) return { item: tenure };
  if (name === "digitaltwin_node_list") return { items: [{ id: "n1", name: "Zoldhalom Library", kind: "building" }] };
  if (name === taskList) return { items: tasks };
  return { items: [] };
};

beforeEach(() => {
  openAgency("zoldhalom");
  permissions = ["asset.manage"];
  asset = library;
  listed = [library, unlinked];
  landed = { pathname: "", state: null };
  called = vi.spyOn(mcp, "callTool").mockImplementation(async (_agency, name, args) => answer(name, args));
});

afterEach(() => {
  cleanup();
  forgetOpenAgency();
  forgetWidth();
  vi.restoreAllMocks();
});

const callsTo = (name: string) => called.mock.calls.filter(([, tool]) => tool === name);

const show = (entry: string | { pathname: string; state: unknown }) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>{routes()}</Routes>
      <Where />
    </MemoryRouter>,
  );

const showPhone = (placeId: string) => {
  setWide(false);
  show(placePaths.place.path({ placeId }));
  return placePaths.place.path({ placeId });
};

const showWide = async (name: string) => {
  setWide(true);
  show(placePaths.places.path());
  await userEvent.click(await screen.findByText(name, { selector: ".ttl" }));
  return placePaths.places.path();
};

const rowOf = (title: string) => screen.getByText(title, { selector: ".ttl" }).closest(".row") as HTMLElement;

const holdingPath = () => `${placePaths.ownership.path()}/t1`;

const surfaces = [
  { surface: "the phone page", open: async () => showPhone("a1"), openUnlinked: async () => showPhone("a2") },
  {
    surface: "the wide pane beside the list",
    open: async () => showWide("Zoldhalom Library"),
    openUnlinked: async () => showWide("Zoldhalom Market Hall"),
  },
];

describe.each(surfaces)("a property with a place, a holding and work orders on $surface", ({ open }) => {
  it("lists the holding with its holder, kind and since day under Holdings", async () => {
    await open();

    expect(await screen.findByRole("heading", { name: "Holdings" })).toBeInTheDocument();
    await screen.findByText("Bela Szabo", { selector: ".ttl" });
    expect(rowOf("Bela Szabo").textContent).toContain("owner · since 2019-03-01");
    expect(screen.queryByText("Anna Kovacs")).toBeNull();
    expect(screen.queryByText("No holdings yet.")).toBeNull();
  });

  it("asks for the holdings of the place named in the property's attributes, and for no other", async () => {
    await open();
    await screen.findByText("Bela Szabo", { selector: ".ttl" });

    expect(called).toHaveBeenCalledWith("", tenureList, { place_id: "n1" });
    for (const [, , args] of callsTo(tenureList)) expect((args as Record<string, unknown>).place_id).toBe("n1");
  });

  it("lists the open and the done work orders that name the property under Works with their state and due day", async () => {
    await open();

    expect(await screen.findByRole("heading", { name: "Works" })).toBeInTheDocument();
    await screen.findByText("Repaint the reading room", { selector: ".ttl" });
    expect(rowOf("Repaint the reading room").textContent).toContain("open · due Friday, 20 Nov");
    expect(rowOf("Replace the gutter").textContent).toContain("done");
    expect(screen.queryByText("Mow the common")).toBeNull();
    expect(screen.queryByText("Order new chairs")).toBeNull();
    expect(screen.queryByText("No works yet.")).toBeNull();
  });

  it("opens the holding on its own route, passing the page it came from so Back names it", async () => {
    const from = await open();

    await userEvent.click(await screen.findByRole("button", { name: /Bela Szabo/ }));

    await waitFor(() => expect(landed.pathname).toBe(holdingPath()));
    expect(landed.state).toMatchObject({ from: { path: from, title: "Places" } });
  });
});

describe.each(surfaces)("a property with no place and no work orders on $surface", ({ openUnlinked }) => {
  beforeEach(() => {
    listed = [unlinked, library];
  });

  it("shows an empty card under Holdings and under Works", async () => {
    await openUnlinked();

    expect(await screen.findByRole("heading", { name: "Holdings" })).toBeInTheDocument();
    expect(await screen.findByText("No holdings yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Works" })).toBeInTheDocument();
    expect(await screen.findByText("No works yet.")).toBeInTheDocument();
  });

  it("makes no tenure call when the property names no place", async () => {
    await openUnlinked();
    await screen.findByText("No holdings yet.");

    expect(callsTo(tenureList)).toHaveLength(0);
  });
});

describe("the holding route", () => {
  const cameFrom = () => ({ path: placePaths.places.path(), title: "Places" });

  it("shows the holding it is opened for with what its read tool replies", async () => {
    show({ pathname: holdingPath(), state: { from: cameFrom() } });

    expect(await screen.findByText("Bela Szabo")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("2019-03-01")).toBeInTheDocument();
    expect(called).toHaveBeenCalledWith("", tenureRead, { tenureID: "t1" });
  });

  it("names the page it came from on the Back button, not Residents, and returns there", async () => {
    show({ pathname: holdingPath(), state: { from: cameFrom() } });
    await screen.findByText("Bela Szabo");

    expect(screen.queryByRole("button", { name: /Residents/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Places/ }));

    await waitFor(() => expect(landed.pathname).toBe(cameFrom().path));
  });
});

describe("placeIdOf", () => {
  const placeIdOf = (records as unknown as { placeIdOf?: (attributesJson: unknown) => string }).placeIdOf as (attributesJson: unknown) => string;

  it("is exported by the properties records", () => {
    expect(typeof placeIdOf).toBe("function");
  });

  it("returns the place_id string from attributes_json", () => {
    expect(placeIdOf(JSON.stringify({ parcel_number: "0412/7", place_id: "n1" }))).toBe("n1");
  });

  it.each([
    ["no attribute", ""],
    ["not JSON", "place_id=n1"],
    ["a JSON list", JSON.stringify(["n1"])],
    ["an object without the key", JSON.stringify({ parcel_number: "0412/7" })],
    ["a place_id that is not text", JSON.stringify({ place_id: 7 })],
    ["undefined", undefined],
  ])("returns an empty string for %s", (_label, attributesJson) => {
    expect(placeIdOf(attributesJson)).toBe("");
  });
});

describe("saving the property edit form", () => {
  it("keeps the place_id attribute while the parcel number changes", async () => {
    setWide(false);
    show(placePaths.place.path({ placeId: "a1" }));

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const parcel = screen.getByLabelText("Parcel number");
    await userEvent.clear(parcel);
    await userEvent.type(parcel, "0412/9");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo("assetmanager_asset_update")).toHaveLength(1));
    const sent = callsTo("assetmanager_asset_update")[0][2] as Record<string, string>;
    expect(JSON.parse(sent.attributes_json)).toEqual({ place_id: "n1", parcel_number: "0412/9" });
  });
});
