import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { AgencyClient, AgencyView } from "../agency/modules";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { SupplierHome } from "../supply/SupplierHome";
import type { Supplier, SupplyClient } from "../supply/api";
import * as mcp from "../wakala/mcp";

const supplierRows = ["Offers", "Asks", "Group order", "Orders", "Your prices", "Forms"];
const stepRows = ["Join a group", "Apply as a supplier"];
const farmerRows = ["Buy inputs", "Sell harvest", "Forms"];

const pathOfRow: Array<[string, string]> = [
  ["Offers", "/offers"],
  ["Asks", "/asks"],
  ["Group order", "/group-orders"],
  ["Orders", "/orders"],
  ["Your prices", "/prices"],
  ["Forms", "/a/farmers/forms"],
  ["Join a group", "/a/farmers/join"],
  ["Apply as a supplier", "/supply/apply"],
];

const shop = (status: string): Supplier => ({
  id: "p1",
  shop: "Kisumu Agro Supplies",
  area: "Kisumu",
  sells: "Fertiliser",
  owner: "m1",
  status,
  approvedBy: "",
  ownerName: "",
  approvedByName: "",
});

const supplyOf = (shops: Supplier[] | Error): SupplyClient => ({
  listSuppliers: vi.fn().mockImplementation(() => (shops instanceof Error ? Promise.reject(shops) : Promise.resolve(shops))),
  applySupplier: vi.fn(),
  listOffers: vi.fn().mockResolvedValue([]),
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
});

const view = (modules: AgencyView["modules"]): AgencyView => ({ name: "Siaya Farmers' Group", modules });

const bothModules = [
  { code: "forms", name: "Forms" },
  { code: "market", name: "Inputs market" },
];

const agencyOf = (read: AgencyView): AgencyClient => ({ read: vi.fn().mockResolvedValue(read) });

const fillForm = (formName: string) => ({
  id: `step-${formName}`,
  title: formName,
  kind: "fill_form",
  role_name: "Farmer",
  form_name: formName,
  questions: [{ prompt: "Question", answer_type: "free_text" }],
});

const chatStep = (workflowName: string) => ({
  id: `chat-${workflowName}`,
  title: "Chat with an agent",
  kind: "chat",
  role_name: "Farmer",
  workflow_name: workflowName,
  opens_in: "chat",
  form_name: "",
  questions: [],
});

const bothSteps = stepRows.map(fillForm);

const answering = (steps: object[]) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_agency: string, tool: string) => {
    if (tool === "agency_list_my_open_steps") return { items: steps };
    if (tool === "agency_get_agency") return { name: "Siaya Farmers' Group" };
    throw new Error(`no answer for ${tool}`);
  }) as never);

const Landed = () => <span data-testid="landed">{useLocation().pathname}</span>;

const show = async (supply: SupplyClient, agency: AgencyClient) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<SupplierHome client={supply} agency={agency} me="m1" />} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

const settled = async (tool = "agency_list_my_open_steps") => {
  await waitFor(() => expect(mcp.callTool).toHaveBeenCalledWith("", tool, {}));
  await act(async () => undefined);
};

const rowElements = () => Array.from(document.querySelectorAll<HTMLElement>("main > .rows > .row"));

const titlesShown = () => rowElements().map((row) => row.querySelector(".ttl")?.textContent);

const approvedSupplier = async (steps: object[] = bothSteps, modules = bothModules) => {
  answering(steps);
  await show(supplyOf([shop("approved")]), agencyOf(view(modules)));
  await screen.findByRole("button", { name: /^Offers/ });
  await settled();
};

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  vi.restoreAllMocks();
  forgetOpenAgency();
});

describe("the Start rows of an approved supplier's Do Something", () => {
  it("are her own six rows of journeys 14 and 16, then Join a group and Apply as a supplier", async () => {
    await approvedSupplier();
    expect(titlesShown()).toEqual([...supplierRows, ...stepRows]);
  });

  it.each(pathOfRow)("open %s on %s", async (title, path) => {
    await approvedSupplier();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${title}`) }));
    expect(screen.getByTestId("landed")).toHaveTextContent(path);
  });

  it("keep Join a group and Apply as a supplier after approval, while the API lists the steps of her Farmer role", async () => {
    await approvedSupplier();
    expect(screen.getByRole("button", { name: /^Join a group/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Apply as a supplier/ })).toBeInTheDocument();
  });

  it("hold only her six rows when the API lists no step for her", async () => {
    await approvedSupplier([]);
    expect(titlesShown()).toEqual(supplierRows);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hold only the workflow rows the API lists", async () => {
    await approvedSupplier([fillForm("Join a group")]);
    expect(titlesShown()).toEqual([...supplierRows, "Join a group"]);
  });

  it("come from the app for her own six rows and the API for the workflow rows, which read no market tool", async () => {
    await approvedSupplier();
    const tools = (mcp.callTool as unknown as { mock: { calls: string[][] } }).mock.calls.map(([, tool]) => tool);
    expect(tools.filter((tool) => tool.startsWith("market_"))).toEqual([]);
    expect(tools).toContain("agency_list_my_open_steps");
  });

  it("carry no mark of their own: a title and the chevron, no lead letter, no icon, no line", async () => {
    await approvedSupplier();
    expect(rowElements()).toHaveLength(supplierRows.length + stepRows.length);
    for (const row of rowElements()) {
      expect(row.tagName).toBe("BUTTON");
      expect(row.querySelector(".lead")).toBeNull();
      expect(row.querySelector("svg")).toBeNull();
      expect(row.querySelector(".meta")).toBeNull();
      expect(row.querySelector(".end")).toHaveTextContent("›");
    }
  });

  it("name Forms as the agency's forms module does", async () => {
    await approvedSupplier(bothSteps, [
      { code: "forms", name: "Paperwork" },
      { code: "market", name: "Inputs market" },
    ]);
    expect(titlesShown()).toEqual(["Offers", "Asks", "Group order", "Orders", "Your prices", "Paperwork", ...stepRows]);
  });

  it("drop her market rows when the agency's market module is off, and keep Forms and the workflow rows", async () => {
    answering(bothSteps);
    await show(supplyOf([shop("approved")]), agencyOf(view([{ code: "forms", name: "Forms" }])));
    await screen.findByRole("button", { name: /^Join a group/ });
    expect(titlesShown()).toEqual(["Forms", ...stepRows]);
  });
});

describe("the Start rows of a Do Something whose shop is not approved", () => {
  const notApproved: Array<[string, Supplier[] | Error]> = [
    ["a pending shop", [shop("pending")]],
    ["no shop", []],
    ["a shop list that cannot be read", new Error("down")],
  ];

  it.each(notApproved)("are the farmer's rows and the workflow rows for %s, with none of the supplier's own", async (_name, shops) => {
    answering([...farmerRows.filter((title) => title !== "Forms").map(chatStep), ...bothSteps]);
    await show(supplyOf(shops), agencyOf(view(bothModules)));
    await screen.findByRole("button", { name: /^Apply as a supplier/ });
    expect(titlesShown()).toEqual([...farmerRows, ...stepRows]);
    ["Offers", "Asks", "Group order", "Orders", "Your prices"].forEach((title) =>
      expect(screen.queryByRole("button", { name: new RegExp(`^${title}`) })).not.toBeInTheDocument(),
    );
  });
});
