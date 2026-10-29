import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { AgencyClient, AgencyView } from "../agency/modules";
import type { Supplier, SupplyClient } from "./api";
import { SupplierHome } from "./SupplierHome";
import { chatStepOf } from "../journeys/chatSteps";
import * as mcp from "../wakala/mcp";

const approved: Supplier = {
  id: "p1",
  shop: "Otieno Rides",
  area: "Siaya",
  sells: "Rides",
  owner: "m1",
  status: "approved",
  approvedBy: "",
  ownerName: "",
  approvedByName: "",
};

const supplyOf = (suppliers: Supplier[]): SupplyClient => ({
  listSuppliers: vi.fn().mockResolvedValue(suppliers),
  applySupplier: vi.fn(),
  listOffers: vi.fn().mockResolvedValue([]),
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
});

const applyStep = {
  id: "a1",
  title: "Apply as a supplier",
  form_name: "Apply as a supplier",
  role_name: "Farmer",
  kind: "fill_form",
  questions: [{ prompt: "Shop name", answer_type: "free_text", required: false }],
};

const withOpenSteps = (items: object[]) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_agency: string, tool: string) => {
    if (tool === "agency_list_my_open_steps") return { items };
    throw new Error("down");
  });

const agencyOf = (view: AgencyView | Error): AgencyClient => ({
  read: vi.fn().mockImplementation(() => (view instanceof Error ? Promise.reject(view) : Promise.resolve(view))),
});

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

const show = (supply: SupplyClient, agency: AgencyClient) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<SupplierHome client={supply} agency={agency} me="m1" />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  withOpenSteps([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Do Something before the agency is read", () => {
  it("shows a loading state and no card list until the agency is read", () => {
    const supply = { ...supplyOf([approved]), listSuppliers: vi.fn().mockReturnValue(new Promise<never>(() => undefined)) };
    show(supply, agencyOf({ name: "x", modules: [] }));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Sell harvest/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Siaya Farmers' Group" })).not.toBeInTheDocument();
  });
});

describe("Do Something of an approved supplier", () => {
  it("gives a shop in the farmers' group the shop cards", async () => {
    show(supplyOf([approved]), agencyOf({ name: "Siaya Farmers' Group", modules: [{ code: "market", name: "Inputs market" }] }));
    expect(await screen.findByRole("button", { name: /^Your prices/ })).toBeInTheDocument();
  });

  it("gives the shop cards when the agency cannot be read", async () => {
    const agency = agencyOf(new Error("down"));
    show(supplyOf([approved]), agency);
    expect(await screen.findByRole("button", { name: /^Your prices/ })).toBeInTheDocument();
    await waitFor(() => expect(agency.read).toHaveBeenCalled());
  });

  it("keeps the plain Do Something while the application waits", async () => {
    const agency = agencyOf({ name: "Siaya Farmers' Group", modules: [{ code: "forms", name: "Forms" }, { code: "market", name: "Inputs market" }] });
    const supply = supplyOf([{ ...approved, status: "pending" }]);
    withOpenSteps([chatStepOf("Sell harvest")]);
    show(supply, agency);
    await waitFor(() => expect(supply.listSuppliers).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /^Forms/ })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Sell harvest/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Your prices/ })).not.toBeInTheDocument();
  });

  it("falls back to the plain Do Something when the suppliers cannot be read", async () => {
    const supply = supplyOf([]);
    (supply.listSuppliers as any).mockRejectedValue(new Error("down"));
    withOpenSteps([chatStepOf("Sell harvest"), applyStep]);
    show(supply, agencyOf({ name: "Siaya Farmers' Group", modules: [{ code: "market", name: "Inputs market" }] }));
    const apply = await screen.findByRole("button", { name: /^Apply as a supplier/ });
    expect(screen.getByRole("button", { name: /^Sell harvest/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Your prices/ })).not.toBeInTheDocument();
    await userEvent.click(apply);
    expect(screen.getByTestId("where")).toHaveTextContent("/supply/apply");
  });
});
