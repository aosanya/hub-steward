import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "../App";
import { doSomethingPathIn, openAgency } from "../agency/open";
import { agenciesFrom, answerWakala } from "./answerWakala";
import { farmerChatSteps } from "./chatSteps";
import * as mcp from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";

type Row = Record<string, any>;

const siaya = { id: "walk-siaya", name: "Siaya Farmers Group" };
const kisumuLab = { id: "walk-kisumu", name: "Kisumu Lab" };

const asha = { id: "hub-asha@mwanachama.test", name: "Asha Otieno" };
const baraka = { id: "hub-baraka@mwanachama.test", name: "Baraka Odhiambo" };
const wanjiru = { id: "hub-wanjiru@mwanachama.test", name: "Wanjiru Kamau" };
const grace = { id: "qa-owner@mwanachama.test", name: "Grace Adhiambo" };

const siayaFarmers = { id: "grp1", name: "Siaya farmers", code: "G-1", public_code: "G-S7F-4KM-2RX", join_mode: "confirmed" };
const kisumuMillers = { id: "grp2", name: "Kisumu millers", code: "G-2", public_code: "G-U3P-8TY-5NW", join_mode: "confirmed" };

const kisumuAgro = { id: "p-kisumu", name: "Kisumu Agro Supplies", owner: "hub-supplier@mwanachama.test", status: "approved" };

const modules = [
  { code: "market", name: "Market", enabled: true },
  { code: "forms", name: "Forms", enabled: true },
];

const joinStep = {
  id: "s-join",
  title: "Ask to join a group",
  kind: "fill_form",
  workflow_id: "w-join",
  role_id: "r-farmer",
  role_name: "Farmer",
  form_name: "Join a group",
  questions: [{ prompt: "Group", answer_type: "free_text" }],
};

const supplierStep = {
  id: "s-supply",
  title: "Ask to sell in the market",
  kind: "fill_form",
  workflow_id: "w-supply",
  role_id: "r-farmer",
  role_name: "Farmer",
  form_name: "Apply as a supplier",
  questions: [
    { prompt: "Shop name", answer_type: "free_text" },
    { prompt: "Area", answer_type: "free_text" },
    { prompt: "What you sell", answer_type: "free_text" },
  ],
};

const startStep = {
  id: "s-start",
  title: "Start the urea group order",
  kind: "fill_form",
  workflow_id: "w-order",
  role_id: "r-coordinator",
  role_name: "Group coordinator",
  form_name: "Urea group order",
  questions: [
    { prompt: "Product", answer_type: "free_text" },
    { prompt: "Price a bag", answer_type: "currency" },
    { prompt: "Minimum bags", answer_type: "number" },
  ],
};

const paymentsRecord = {
  code: "RC-1",
  name: "Payments",
  can_add_rows: true,
  questions: [
    { prompt: "Farmer", answer_type: "single_choice", options_from: "members" },
    { prompt: "Amount paid", answer_type: "currency" },
  ],
};

const bagsJoined = 4;

const shopApplication = { name: "Asha Seeds and Feed", area: "Siaya town", posts: "Maize seed and chicken feed" };

const groupOrderAnswers = { product: "Urea 50kg", price: "3600", minimum: "20" };

const secondOrderAnswers = { product: "Maize seed", price: "5000", minimum: "10" };

const freshWorld = () => {
  const world = {
    caller: asha.id,
    agencies: [siaya, kisumuLab] as Row[],
    groups: [siayaFarmers, kisumuMillers] as Row[],
    joinRequests: [] as Row[],
    suppliers: [{ ...kisumuAgro }] as Row[],
    groupOrders: [] as Row[],
    calls: [] as Array<[string, Row]>,
  };

  const isCoordinator = () => world.caller === grace.id;

  const stepsOfCaller = () => (isCoordinator() ? [startStep] : [...farmerChatSteps, joinStep, supplierStep]);

  const orderAsSeen = (order: Row) => ({ ...order, lines: order.lines.filter((line: Row) => line.picker === world.caller) });

  const orderNamed = (id: unknown) => world.groupOrders.find((order) => order.id === id)!;

  const reply = async (_hub: string, tool: string, args: Row = {}): Promise<any> => {
    world.calls.push([tool, args]);
    switch (tool) {
      case "agency_list_instances":
        return { items: world.agencies };
      case "agency_get_agency":
        return { id: siaya.id, name: siaya.name };
      case "agency_list_modules":
        return { items: modules };
      case "forms_form_list_waiting":
        return { items: [] };
      case "agency_list_my_open_steps":
        return { items: stepsOfCaller() };
      case "agency_get_my_roles":
        return { instance_id: siaya.id, membership: isCoordinator() ? "owner" : "resident", roles: [] };
      case "comm_notification_list":
        return { items: [] };
      case "comm_notification_mark_read":
        return { marked: 0 };
      case "actor_list_my_invitations":
        return { items: [] };
      case "actor_list_joinable_groups":
        return { items: world.groups };
      case "actor_join_group": {
        const request = { group_id: args.group_id, member: world.caller, state: "pending" };
        world.joinRequests.push(request);
        return { group_id: request.group_id, state: request.state };
      }
      case "actor_list_my_join_requests":
        return { items: world.joinRequests.filter((request) => request.member === world.caller).map(({ group_id, state }) => ({ group_id, state })) };
      case "actor_list_my_groups":
        return { items: [] };
      case "actor_list_group_leaders":
        return { items: [] };
      case "market_list_posters":
        return { items: world.suppliers };
      case "market_apply_poster": {
        const shop = {
          id: "p-asha",
          name: args.name,
          area: args.area,
          posts: args.posts,
          owner: world.caller,
          status: "pending",
          approved_by: "",
          owner_name: asha.name,
          approved_by_name: "",
        };
        world.suppliers.push(shop);
        return shop;
      }
      case "market_get_group_order_poster":
        return { poster_id: kisumuAgro.id, poster_name: kisumuAgro.name };
      case "market_start_group_order": {
        const order = {
          id: `g${world.groupOrders.length + 1}`,
          poster_id: args.poster_id,
          coordinator: world.caller,
          product: args.product,
          direction: "buy",
          state: "open",
          price: args.price,
          minimum: args.minimum,
          terms_version: 1,
          terms_history: JSON.stringify([{ version: 1, price: args.price, minimum: args.minimum }]),
          total: 0,
          count: 0,
          lines: [] as Row[],
        };
        world.groupOrders.push(order);
        return orderAsSeen(order);
      }
      case "market_list_group_orders":
        return { items: world.groupOrders.map(orderAsSeen) };
      case "market_get_group_order":
        return orderAsSeen(orderNamed(args.groupOrderID));
      case "agency_list_live_records":
        return { items: [paymentsRecord] };
      case "actor_list_actors":
        return { items: [grace, asha, baraka, wanjiru].map(({ id, name }) => ({ id, display_name: name })) };
      case "market_list_orders":
        return { items: [] };
      case "market_list_offers":
        return { items: [] };
      default:
        throw new Error(`the walk has no answer for ${tool}`);
    }
  };

  const approveSupplier = () => {
    const shop = world.suppliers.find((s) => s.owner === asha.id)!;
    shop.status = "approved";
    shop.approved_by = grace.id;
    shop.approved_by_name = grace.name;
  };

  const joinsOrder = (who: { id: string; name: string }, id: string) => {
    const order = orderNamed(id);
    order.lines.push({ id: `l-${who.id}`, picker: who.id, picker_name: who.name, quantity: bagsJoined, answer: "" });
    order.total += bagsJoined;
    order.count += 1;
  };

  const called = (tool: string) => world.calls.filter(([name]) => name === tool).map(([, args]) => args);

  return { world, reply, approveSupplier, joinsOrder, called };
};

type Fakes = ReturnType<typeof freshWorld>;

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

let shown: ReturnType<typeof render> | undefined;

const visit = (path: string) => {
  shown?.unmount();
  shown = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  );
};

const where = () => screen.getByTestId("where").textContent ?? "";

const doSomethingOf = doSomethingPathIn;

const pressed = (name: string | RegExp) => userEvent.click(screen.getByRole("button", { name }));

const typed = async (label: string, text: string) => userEvent.type(await screen.findByLabelText(label), text);

const heading = (name: string, level = 1) => screen.findByRole("heading", { name, level });

const tabsBar = () => within(screen.getByRole("navigation", { name: "Main" }));

const doSomethingTab = () => tabsBar().getByRole("link", { name: /Start$/ });

const farmerStartRows = ["Buy inputs", "Sell harvest", modules[1].name, joinStep.form_name, supplierStep.form_name];

const startRowsShown = () => Array.from(document.querySelectorAll<HTMLElement>("main > .rows > .row .ttl")).map((title) => title.textContent);

const startRow = (name: string) => screen.findByRole("button", { name: new RegExp(`^${name}`) });

const rowsShown = () =>
  Array.from(document.querySelectorAll<HTMLElement>(".rows .row")).map((row) => [
    row.querySelector(".ttl")?.textContent ?? "",
    row.querySelector(".meta")?.textContent ?? "",
  ]);

const ongoingRowsAre = async (expected: string[][]) => {
  if (expected.length === 0) {
    expect(await screen.findByText("Nothing ongoing yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Start" })).toBeInTheDocument();
    expect(rowsShown()).toEqual([]);
    return;
  }
  await screen.findByText(expected[0][0]);
  expect(rowsShown()).toEqual(expected);
  expect(screen.queryByText("Nothing ongoing yet")).toBeNull();
};

const startSegment = () => tabsBar().getByRole("link", { name: /Start$/ });

const ongoingSegment = () => tabsBar().getByRole("link", { name: /Ongoing$/ });

const ongoingOpened = async () => {
  await userEvent.click(ongoingSegment());
  expect(ongoingSegment()).toHaveAttribute("aria-current", "page");
  expect(startSegment()).not.toHaveAttribute("aria-current");
};

const rowTitled = (title: string) => screen.getByText(title).closest(".row") as HTMLElement;

let fakes: Fakes;

const walkAs = (member: { id: string }) => {
  fakes.world.caller = member.id;
  forgetSubject();
  vi.stubGlobal("fetch", answerWakala(() => member.id, agenciesFrom(fakes.reply as any)));
  vi.spyOn(mcp, "callTool").mockImplementation(fakes.reply as any);
};

const joinRowOf = (group: Row) => [group.name, "Join a group · Requested"];

const shopRowOf = (shop: Row) => [shop.name, "Apply as a supplier · Asked"];

const orderRowOf = (order: Row) => [order.product, "Create group order · Open"];
const joinedRowOf = (order: Row) => [order.product, "Group order · Open"];

const pendingJoinRows = () =>
  fakes.world.joinRequests
    .filter((request) => request.member === asha.id && request.state === "pending")
    .map((request) => joinRowOf(fakes.world.groups.find((group) => group.id === request.group_id)!));

const pendingShopRows = () => fakes.world.suppliers.filter((s) => s.owner === asha.id && s.status !== "approved").map(shopRowOf);

const opensDoSomething = async () => {
  walkAs(asha);
  visit(doSomethingOf(siaya.id));
  await heading("Do Something");
  await startRow(joinStep.form_name);
};

const startStillListsEveryStep = async () => {
  visit(doSomethingOf(siaya.id));
  await heading("Do Something");
  await startRow(joinStep.form_name);
  expect(startRowsShown()).toEqual(farmerStartRows);
};

const opensOngoing = async () => {
  visit(doSomethingOf(siaya.id));
  await heading("Do Something");
  await ongoingOpened();
};

const step1AFarmerOpensHome = async () => {
  await opensDoSomething();

  expect(screen.getAllByRole("heading", { level: 1 }).map((title) => title.textContent)).toEqual(["Do Something"]);
  expect(within(screen.getByRole("main")).getByText(siaya.name)).toHaveClass("sub");
  expect(within(screen.getByRole("main")).queryAllByRole("heading")).toEqual([]);
  expect(tabsBar().getAllByRole("link").slice(0, 3).map((link) => link.textContent?.replace(/[^A-Za-z ]/g, ""))).toEqual(["Home", "Start", "Ongoing"]);
  expect(startSegment()).toHaveAttribute("aria-current", "page");
  expect(ongoingSegment()).not.toHaveAttribute("aria-current");
  expect(screen.queryByText("Nothing ongoing yet")).toBeNull();
  expect(fakes.called("agency_list_my_open_steps")).not.toHaveLength(0);
  expect(startRowsShown()).toEqual(farmerStartRows);
  for (const item of ["My profile", "Switch agency", "Change language", "Sign out"]) {
    expect(screen.queryByText(item)).toBeNull();
  }
  expect(screen.queryByText(startStep.form_name)).toBeNull();

  const menuButton = screen.getByRole("button", { name: "Menu" });
  expect(menuButton.closest("header.bar")).not.toBeNull();
  expect(menuButton).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
  expect(screen.queryByRole("menu")).toBeNull();

  expect(tabsBar().getAllByRole("link").map((tab) => tab.textContent)).toEqual(["Home", "Start", "Ongoing"]);
  expect(doSomethingTab()).toHaveAttribute("aria-current", "page");
};

const step2SheOpensTheMenu = async () => {
  await opensDoSomething();

  await pressed("Menu");
  const menu = await screen.findByRole("menu", { name: "Menu" });
  expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "true");
  const items = within(menu).getAllByRole("menuitem");
  expect(items).toHaveLength(4);
  ["My profile", "Switch agency", "Change language", "Sign out"].forEach((name, at) => {
    expect(within(menu).getByRole("menuitem", { name })).toBe(items[at]);
  });

  await userEvent.click(within(menu).getByRole("menuitem", { name: /Switch agency/ }));
  expect(await heading("Your agencies")).toBeInTheDocument();
  expect(where()).toBe("/agencies");
  for (const agency of [siaya, kisumuLab]) expect(await screen.findByText(agency.name)).toBeInTheDocument();
  expect(fakes.called("agency_list_instances")).not.toHaveLength(0);
};

const step3SheAsksToJoinAGroup = async () => {
  await opensDoSomething();

  await userEvent.click(await startRow(joinStep.form_name));
  expect(await heading(joinStep.form_name)).toBeInTheDocument();
  expect(where()).toBe(`/a/${siaya.id}/join`);
  await screen.findByText(siayaFarmers.name);
  const group = rowTitled(siayaFarmers.name);
  expect(within(group).getByText(new RegExp(siayaFarmers.public_code))).toBeInTheDocument();
  expect(rowTitled(kisumuMillers.name)).toHaveTextContent(kisumuMillers.public_code);

  await userEvent.click(within(group).getByRole("button", { name: "Ask to join" }));
  expect(await within(group).findByRole("button", { name: "Requested" })).toBeDisabled();
  expect(fakes.called("actor_join_group")).toEqual([{ group_id: siayaFarmers.id }]);
  expect(within(rowTitled(kisumuMillers.name)).getByRole("button", { name: "Ask to join" })).toBeEnabled();

  await startStillListsEveryStep();
  await ongoingOpened();
  await ongoingRowsAre(pendingJoinRows());
  expect(where()).toBe(`/a/${siaya.id}/ongoing`);
  expect(rowsShown()).toContainEqual(joinRowOf(siayaFarmers));

  await userEvent.click(rowTitled(siayaFarmers.name));
  expect(await heading(joinStep.form_name)).toBeInTheDocument();
  expect(where()).toBe(`/a/${siaya.id}/join`);
  expect(await within(rowTitled(siayaFarmers.name)).findByRole("button", { name: "Requested" })).toBeDisabled();
};

const step4SheAppliesAsASupplier = async () => {
  await opensDoSomething();

  await userEvent.click(await startRow(supplierStep.form_name));
  expect(await heading(supplierStep.form_name)).toBeInTheDocument();
  expect(where()).toBe("/supply/apply");
  await typed("Shop name", shopApplication.name);
  await typed("Area", shopApplication.area);
  await typed("What you sell", shopApplication.posts);
  await pressed("Send application");

  expect(await heading("Your application")).toBeInTheDocument();
  expect(fakes.called("market_apply_poster")).toEqual([
    { name: shopApplication.name, area: shopApplication.area, posts: shopApplication.posts },
  ]);
  const application = rowTitled(shopApplication.name);
  expect(application).toHaveTextContent(`${shopApplication.area} · ${shopApplication.posts}`);
  expect(application).toHaveTextContent("Asked");

  await startStillListsEveryStep();
  await ongoingOpened();
  await ongoingRowsAre([...pendingJoinRows(), ...pendingShopRows()]);
  expect(rowsShown()).toContainEqual(shopRowOf({ name: shopApplication.name }));

  await userEvent.click(rowTitled(shopApplication.name));
  expect(await heading("Your application")).toBeInTheDocument();
  expect(where()).toBe("/supply/apply");

  fakes.approveSupplier();
  walkAs(asha);
  await opensOngoing();
  await ongoingRowsAre(pendingJoinRows());
  expect(screen.queryByText(shopApplication.name)).toBeNull();
};

const fillsTheStartForm = async (answers: typeof groupOrderAnswers) => {
  await typed(startStep.questions[0].prompt, answers.product);
  await typed(startStep.questions[1].prompt, answers.price);
  await typed(startStep.questions[2].prompt, answers.minimum);
  await pressed("Start");
};

const step5TheCoordinatorStartsTheGroupOrder = async () => {
  walkAs(grace);
  visit(doSomethingOf(siaya.id));
  expect(await screen.findByText(startStep.form_name)).toBeInTheDocument();
  expect(startRowsShown()[0]).toBe(startStep.form_name);
  expect(screen.queryByText("Waiting on you")).toBeNull();

  await userEvent.click(screen.getByText(startStep.form_name));
  expect(await heading(startStep.title)).toBeInTheDocument();
  expect(where()).toBe(`/a/${siaya.id}/start/${startStep.id}`);
  await fillsTheStartForm(groupOrderAnswers);

  await waitFor(() => expect(where()).toBe("/coordinator/orders/g1"));
  expect(await screen.findByText("Manage payments")).toBeInTheDocument();
  expect(screen.getByText(groupOrderAnswers.product)).toBeInTheDocument();
  expect(screen.getByText(new RegExp(grace.name))).toBeInTheDocument();
  expect(fakes.called("market_start_group_order")).toEqual([
    {
      poster_id: kisumuAgro.id,
      product: groupOrderAnswers.product,
      price: Number(groupOrderAnswers.price),
      minimum: Number(groupOrderAnswers.minimum),
    },
  ]);

  walkAs(grace);
  visit(doSomethingOf(siaya.id));
  await heading("Do Something");
  await startRow(startStep.form_name);
  expect(startRowsShown()[0]).toBe(startStep.form_name);
  expect(screen.queryByText(groupOrderAnswers.product)).toBeNull();

  await ongoingOpened();
  await ongoingRowsAre([orderRowOf(fakes.world.groupOrders[0])]);

  await userEvent.click(rowTitled(groupOrderAnswers.product));
  await waitFor(() => expect(where()).toBe("/coordinator/orders/g1"));
  expect(await screen.findByText("Manage payments")).toBeInTheDocument();

  visit(doSomethingOf(siaya.id));
  await userEvent.click(await startRow(startStep.form_name));
  expect(await heading(startStep.title)).toBeInTheDocument();
  expect(where()).toBe(`/a/${siaya.id}/start/${startStep.id}`);
  await fillsTheStartForm(secondOrderAnswers);
  await waitFor(() => expect(where()).toBe("/coordinator/orders/g2"));
  expect(await screen.findByText("Manage payments")).toBeInTheDocument();

  walkAs(grace);
  await opensOngoing();
  await ongoingRowsAre(fakes.world.groupOrders.map(orderRowOf));
  expect(rowsShown().map(([product]) => product)).toEqual([groupOrderAnswers.product, secondOrderAnswers.product]);

  fakes.joinsOrder(baraka, "g1");
  walkAs(baraka);
  await opensOngoing();
  await ongoingRowsAre([joinedRowOf(fakes.world.groupOrders[0])]);
  await userEvent.click(rowTitled(groupOrderAnswers.product));
  await waitFor(() => expect(where()).toBe("/my-orders/group/g1"));
  expect(await heading(`${bagsJoined} of ${groupOrderAnswers.product}`)).toBeInTheDocument();
  expect(screen.getByText(kisumuAgro.name)).toBeInTheDocument();

  walkAs(wanjiru);
  await opensOngoing();
  await ongoingRowsAre([]);
};

const step6NothingBegunShowsTheEmptyCard = async () => {
  walkAs(wanjiru);
  await opensOngoing();

  await ongoingRowsAre([]);
  await pressed("Go to Start");
  await heading("Do Something");
  expect(where()).toBe(doSomethingOf(siaya.id));
  expect(startSegment()).toHaveAttribute("aria-current", "page");
  expect(ongoingSegment()).not.toHaveAttribute("aria-current");
  expect(within(screen.getByRole("main")).getByText(siaya.name)).toHaveClass("sub");
  expect(await startRow(joinStep.form_name)).toBeInTheDocument();
  expect(startRowsShown()).toEqual(farmerStartRows);
  expect(screen.queryByText("Nothing ongoing yet")).toBeNull();
  expect(doSomethingTab()).toHaveAttribute("aria-current", "page");
};

beforeEach(() => {
  fakes = freshWorld();
  openAgency(siaya.id);
  forgetSubject();
});

afterEach(() => {
  shown = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  forgetSubject();
});

describe("journey 22 and 18, the agency's workflows on Do Something and the Ongoing rows", () => {
  it("step 1: a farmer opens Do Something and finds the agency name under the title, Start chosen beside Ongoing, the workflows as rows, the Menu button in the bar and no account items", step1AFarmerOpensHome);

  it("step 2: she opens the Menu, sees its four items and Switch agency goes to the agency list", step2SheOpensTheMenu);

  it("step 3: she opens the Join a group row, asks to join, and Start keeps the row while Ongoing holds the group as Join a group, Requested", step3SheAsksToJoinAGroup);

  it("step 4: she opens the Apply as a supplier row, sends an application, and Start keeps both rows while Ongoing holds the shop until the coordinator approves", step4SheAppliesAsASupplier);

  it("step 5: the coordinator starts a group order from the first Start row, which stays for a second order, Ongoing holds each as Create group order, Open, and a farmer who joined sees one as Group order, Open", step5TheCoordinatorStartsTheGroupOrder);

  it("step 6: with nothing begun, Ongoing shows the empty card and Go to Start returns to the Start list of Do Something", step6NothingBegunShowsTheEmptyCard);

  it("runs steps 1 to 6 in order in one world", async () => {
    await step1AFarmerOpensHome();
    await step2SheOpensTheMenu();
    await step3SheAsksToJoinAGroup();
    await step4SheAppliesAsASupplier();
    await step5TheCoordinatorStartsTheGroupOrder();
    await step6NothingBegunShowsTheEmptyCard();
  });
});
