import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "../App";
import { agencyBasePath, doSomethingPathIn, openAgency } from "../agency/open";
import { agenciesFrom, answerWakala } from "./answerWakala";
import * as mcp from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";
import { agency, callsTo, coordinator, farmers, freshWorld, paymentsRecord, poster, reply, startStep, type World } from "./walk18.test-support";

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  );

const where = () => screen.getByTestId("where").textContent ?? "";

const tapped = (name: string | RegExp) => userEvent.click(screen.getByRole("button", { name }));

const startRowsShown = () => Array.from(document.querySelectorAll<HTMLElement>("main > .rows > .row .ttl")).map((title) => title.textContent);

const firstStartRow = () => startRowsShown()[0];

const ongoingRowsShown = () =>
  Array.from(document.querySelectorAll<HTMLElement>("main .rows .row")).map((row) => [
    row.querySelector(".ttl")?.textContent ?? "",
    row.querySelector(".meta")?.textContent ?? "",
  ]);

const atOngoing = async () => {
  at(`${agencyBasePath(agency.id)}/ongoing`);
  await screen.findByRole("heading", { level: 1 });
};

const liveOrder = (id: string, product: string) => ({
  id,
  poster_id: poster.id,
  coordinator: coordinator.id,
  product,
  direction: "buy",
  state: "open",
  price: 3600,
  minimum: 20,
  total: 8,
  count: 3,
});

let world: World;

const withNoJoinRequests = (answer: ReturnType<typeof reply>) => (hub: string, tool: string, args?: Record<string, unknown>) =>
  tool === "actor_list_my_join_requests" ? Promise.resolve({ items: [] }) : answer(hub, tool, args);

const walkAs = (id: string) => {
  world.caller = id;
  forgetSubject();
  const answer = withNoJoinRequests(reply(world));
  vi.stubGlobal("fetch", answerWakala(() => id, agenciesFrom(answer as any)));
  vi.spyOn(mcp, "callTool").mockImplementation(answer as any);
};

beforeEach(() => {
  world = freshWorld();
  openAgency(agency.id);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  forgetSubject();
});

describe("journey 18, steps 1 to 4: the Group coordinator runs a group order", () => {
  it("sees what waits, starts the order, manages payments and sends it", async () => {
    walkAs(coordinator.id);
    const [asha, baraka, chebet, kisumu] = farmers;
    const [product, price, minimum] = ["Urea 50kg", "3600", "20"];

    at(doSomethingPathIn(agency.id));
    expect(await screen.findByText(startStep.form_name)).toBeInTheDocument();
    expect(firstStartRow()).toBe(startStep.form_name);
    expect(screen.queryByText("Waiting on you")).not.toBeInTheDocument();
    expect(callsTo(world, "agency_list_my_open_steps")).not.toHaveLength(0);

    await userEvent.click(screen.getByText(startStep.form_name));
    expect(await screen.findByRole("heading", { name: startStep.title })).toBeInTheDocument();
    expect(where()).toBe(`/a/${agency.id}/start/${startStep.id}`);
    await userEvent.type(await screen.findByLabelText(startStep.questions[0].prompt), product);
    await userEvent.type(screen.getByLabelText(startStep.questions[1].prompt), price);
    await userEvent.type(screen.getByLabelText(startStep.questions[2].prompt), minimum);
    expect(callsTo(world, "market_get_group_order_poster")).not.toHaveLength(0);
    await tapped("Start");

    expect(await screen.findByText("Manage payments")).toBeInTheDocument();
    expect(where()).toBe("/coordinator/orders/g1");
    expect(callsTo(world, "market_start_group_order")).toEqual([{ poster_id: poster.id, product, price: Number(price), minimum: Number(minimum) }]);
    expect(screen.getByText(world.groupOrders[0].product)).toBeInTheDocument();
    expect(screen.getByText("KES 3,600 a bag from 20 bags")).toBeInTheDocument();
    expect(screen.getByText("0 bags of 20")).toBeInTheDocument();
    expect(screen.getByText(coordinator.name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send the order" })).toBeInTheDocument();

    await userEvent.click(screen.getByText("Manage payments"));
    expect(await screen.findByText(asha.display_name)).toBeInTheDocument();
    expect(where()).toBe("/coordinator/orders/g1/payments");
    expect(callsTo(world, "agency_list_live_record_rows")).toContainEqual({ record_code: paymentsRecord.code, order_id: "g1" });
    for (const farmer of [asha, baraka, chebet]) expect(screen.getByText(farmer.display_name)).toBeInTheDocument();
    expect(screen.getAllByText("KES 7,200")).toHaveLength(2);
    expect(screen.getByText("KES 3,600")).toBeInTheDocument();

    await tapped("Add a payment");
    expect(await screen.findByRole("heading", { name: "Add a payment" })).toBeInTheDocument();
    await userEvent.click(await screen.findByLabelText(paymentsRecord.questions[0].prompt));
    await userEvent.type(screen.getByRole("combobox"), "kisumu");
    await userEvent.click(screen.getByRole("option", { name: kisumu.display_name }));
    await userEvent.type(screen.getByLabelText(paymentsRecord.questions[1].prompt), "1500");
    await tapped("Save payment");
    expect(await screen.findByRole("heading", { name: "Manage payments" })).toBeInTheDocument();
    expect(callsTo(world, "agency_add_live_record_row")[0]).toEqual({
      record_code: paymentsRecord.code,
      order_id: "g1",
      answers: { Farmer: kisumu.id, "Amount paid": "1500" },
    });
    await tapped(/show more/i);
    expect(await screen.findByText(kisumu.display_name)).toBeInTheDocument();
    expect(screen.getByText("KES 1,500")).toBeInTheDocument();

    await userEvent.click(screen.getByText(baraka.display_name));
    const amount = await screen.findByLabelText(paymentsRecord.questions[1].prompt);
    expect(where()).toBe("/coordinator/orders/g1/payments/pr2/correct");
    expect(amount).toHaveValue("3600");
    await userEvent.clear(amount);
    await userEvent.type(amount, "4000");
    await tapped("Save payment");
    await userEvent.click(await screen.findByRole("button", { name: /show more/i }));
    expect(await screen.findByText("Corrected on 2026-11-02")).toBeInTheDocument();
    expect(callsTo(world, "agency_add_live_record_row")[1]).toEqual({
      record_code: paymentsRecord.code,
      order_id: "g1",
      answers: { Farmer: baraka.id, "Amount paid": "4000" },
      replaces: "pr2",
    });
    expect(screen.getByText("KES 4,000")).toBeInTheDocument();
    expect(screen.queryByText("KES 3,600")).not.toBeInTheDocument();

    await tapped("Add a payment");
    await userEvent.click(await screen.findByLabelText(paymentsRecord.questions[0].prompt));
    await userEvent.type(screen.getByRole("combobox"), "kisumu");
    await userEvent.click(screen.getByRole("option", { name: kisumu.display_name }));
    await userEvent.type(screen.getByLabelText(paymentsRecord.questions[1].prompt), "1500");
    await tapped("Save payment");
    expect(await screen.findByText("This payment was just saved. Wait a minute to save it again.")).toBeInTheDocument();
    expect(callsTo(world, "agency_add_live_record_row")).toHaveLength(3);
    expect(where()).toBe("/coordinator/orders/g1/payments/new");

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    await tapped("Send the order");
    expect(await screen.findByText("Sent")).toBeInTheDocument();
    expect(callsTo(world, "market_send_group_order")).toEqual([{ groupOrderID: "g1" }]);
    expect(world.groupOrders[0].state).toBe("sent");
    expect(screen.queryByRole("button", { name: "Send the order" })).not.toBeInTheDocument();
  });
});

describe("journey 18, what a farmer and a called-off order show", () => {
  it("gives a farmer no Create group order row, no Send button and no Add a payment", async () => {
    world.membership = "resident";
    world.groupOrders.push({ id: "g1", poster_id: poster.id, coordinator: coordinator.id, product: "Urea 50kg", direction: "buy", state: "open", price: 3600, minimum: 20, total: 8, count: 3 });
    walkAs(farmers[0].id);

    at(doSomethingPathIn(agency.id));
    expect(await screen.findByText(agency.name)).toBeInTheDocument();
    await waitFor(() => expect(callsTo(world, "agency_list_my_open_steps")).not.toHaveLength(0));
    expect(screen.queryByText(startStep.form_name)).not.toBeInTheDocument();
    expect(screen.queryByText(world.groupOrders[0].product)).not.toBeInTheDocument();

    at("/coordinator/orders/g1");
    expect(await screen.findByText("Manage payments")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send the order" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Manage payments"));
    expect(await screen.findByText(farmers[0].display_name)).toBeInTheDocument();
    expect(screen.queryByText(farmers[1].display_name)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a payment" })).not.toBeInTheDocument();
  });

  it("opens the group order from a called-off Inbox row", async () => {
    world.groupOrders.push({ id: "g1", poster_id: poster.id, coordinator: coordinator.id, product: "Urea 50kg", direction: "buy", state: "cancelled", price: 3600, minimum: 20, total: 8, count: 3 });
    world.notifications.push({ id: "n1", event: "group_order_called_off", subject_kind: "group_order", subject_id: "g1", names: { product: "Urea 50kg" }, created_at: "2026-11-01T16:40:00Z" });
    walkAs(coordinator.id);

    at(`/a/${agency.id}/inbox`);
    await userEvent.click(await screen.findByText("The Urea 50kg group order was called off"));
    expect(await screen.findByText("Manage payments")).toBeInTheDocument();
    expect(where()).toBe("/coordinator/orders/g1");
    expect(screen.getByText(world.groupOrders[0].product)).toBeInTheDocument();
    expect(callsTo(world, "market_get_group_order")).toContainEqual({ groupOrderID: "g1" });
  });
});

describe("journey 18, the Ongoing segment", () => {
  it("lists the Group coordinator's live order as a row, which opens from it", async () => {
    world.groupOrders.push(liveOrder("g1", "Urea 50kg"));
    walkAs(coordinator.id);

    await atOngoing();
    const row = (await screen.findByText("Urea 50kg")).closest(".row") as HTMLElement;
    expect(within(row).getByText("Create group order · Open")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).queryAllByRole("heading").map((heading) => heading.textContent)).toEqual(["With others"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Apps|Started/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: startStep.form_name })).not.toBeInTheDocument();
    expect(screen.queryByText(startStep.form_name)).not.toBeInTheDocument();

    await userEvent.click(row);
    expect(await screen.findByText("Manage payments")).toBeInTheDocument();
    expect(where()).toBe("/coordinator/orders/g1");
  });

  it("lists each live order of the Group coordinator as its own row", async () => {
    world.groupOrders.push(liveOrder("g1", "Urea 50kg"), liveOrder("g2", "Maize seed"));
    walkAs(coordinator.id);

    await atOngoing();
    await screen.findByText("Maize seed");
    expect(ongoingRowsShown()).toEqual([
      ["Urea 50kg", "Create group order · Open"],
      ["Maize seed", "Create group order · Open"],
    ]);
  });

  it("says so to a farmer with nothing ongoing, and Go to Start returns to the Start rows", async () => {
    world.membership = "resident";
    walkAs(farmers[0].id);

    await atOngoing();
    expect(await screen.findByText("Nothing ongoing yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: startStep.form_name })).not.toBeInTheDocument();
    expect(ongoingRowsShown()).toEqual([]);

    await tapped("Go to Start");
    expect(screen.queryByText("Nothing ongoing yet")).not.toBeInTheDocument();
    expect(where()).toBe(doSomethingPathIn(agency.id));
  });
});

describe("journey 18, the Start step on Do Something and in the Inbox", () => {
  it("counts in the Inbox badge, with a dot, the agency and the role, and no time", async () => {
    walkAs(coordinator.id);

    at(`/a/${agency.id}/inbox`);
    const row = (await screen.findByText(startStep.title)).closest(".row") as HTMLElement;
    expect(within(row).getByLabelText("Unread")).toBeInTheDocument();
    expect(within(row).getByText(`${agency.name} · ${startStep.role_name}`)).toBeInTheDocument();
    expect(row.querySelector(".end")).toBeNull();
    expect(screen.getByLabelText("1 thing to do")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
    expect(screen.queryByText("You are all caught up")).not.toBeInTheDocument();
  });

  it("keeps the Create group order row first in Start while an order is live, which is a row of Ongoing and not of Start", async () => {
    world.groupOrders.push(liveOrder("g1", "Urea 50kg"));
    walkAs(coordinator.id);

    at(doSomethingPathIn(agency.id));
    expect(await screen.findByText(startStep.form_name)).toBeInTheDocument();
    expect(screen.queryByText("Urea 50kg")).not.toBeInTheDocument();
    expect(screen.queryByText("Waiting on you")).not.toBeInTheDocument();
    expect(screen.queryByText("My profile")).not.toBeInTheDocument();
    expect(firstStartRow()).toBe(startStep.form_name);
  });
});

describe("journey 18, a second order", () => {
  it.each(["open", "revising", "sent", "cancelled"])("is started from the Create group order row while the first order is %s", async (state) => {
    world.groupOrders.push({ id: "g0", poster_id: poster.id, coordinator: coordinator.id, product: "Maize seed", direction: "buy", state, price: 5000, minimum: 10, total: 12, count: 4 });
    walkAs(coordinator.id);

    at(doSomethingPathIn(agency.id));
    await userEvent.click(await screen.findByText(startStep.form_name));
    await userEvent.type(await screen.findByLabelText(startStep.questions[0].prompt), "Urea 50kg");
    await userEvent.type(screen.getByLabelText(startStep.questions[1].prompt), "3600");
    await userEvent.type(screen.getByLabelText(startStep.questions[2].prompt), "20");
    await tapped("Start");

    expect(await screen.findByText("Manage payments")).toBeInTheDocument();
    expect(where()).toBe("/coordinator/orders/g1");
    expect(callsTo(world, "market_start_group_order")).toEqual([{ poster_id: poster.id, product: "Urea 50kg", price: 3600, minimum: 20 }]);
  });
});

describe("journey 18, the coordinator on her order", () => {
  it("is named Group coordinator, never by her id, when her actor has no display name", async () => {
    world.coordinatorName = "";
    world.groupOrders.push({ id: "g1", poster_id: poster.id, coordinator: coordinator.id, product: "Urea 50kg", direction: "buy", state: "open", price: 3600, minimum: 20, total: 8, count: 3 });
    walkAs(coordinator.id);

    const { container } = at("/coordinator/orders/g1");
    expect(await screen.findByText("Manage payments")).toBeInTheDocument();
    expect(screen.getByText("Group coordinator")).toBeInTheDocument();
    expect(container.textContent).not.toContain(coordinator.id);
  });
});
