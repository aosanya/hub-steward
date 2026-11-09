import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openAgency, openAgencyId } from "../agency/open";
import { groupTools } from "../groups/api";
import { words } from "../entry/words";
import { answeringAForm, chattingInARoom, endInAgencies, everyCallNames, groupOrderStep, openApp, riders, shoppingForUrea, startInAgencies, startingAnOrder, stubWakala, where } from "./inAgency.test-support";

beforeEach(startInAgencies);

afterEach(endInAgencies);

const heading = (name: string) => screen.findByRole("heading", { name, level: 1 });

const enteredBy = [
  ["the new path", (path: string) => `/a/${riders.id}${path}`],
  ["the old path", (path: string) => path],
] as const;

describe("join: a member goes in by the new path and by the old one", () => {
  it.each(enteredBy)("asks to join and goes on to Chat, entering by %s", async (_, enter) => {
    const world = stubWakala({
      [groupTools.listJoinable]: () => ({ items: [{ id: "g1", name: "Siaya farmers", public_code: "G-S7F-4KM-2RX", join_mode: "confirmed" }] }),
    });
    openAgency(riders.id);
    openApp(enter("/join"));
    await heading("Join a group");
    expect(where()).toBe(`/a/${riders.id}/join`);
    await userEvent.click(await screen.findByRole("button", { name: "Ask to join" }));
    await screen.findByRole("button", { name: "Requested" });
    await userEvent.click(screen.getByRole("button", { name: "Go to Chat" }));
    await heading("Chat");
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}/chat`));
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });

  it("sends the old path to Your agencies while no agency is open", async () => {
    stubWakala();
    openApp("/join");
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(where()).toBe("/agencies");
  });
});

describe("start: a member goes in by the new path and by the old one", () => {
  it.each(enteredBy)("fills the form, starts the order and lands on it, entering by %s", async (_, enter) => {
    const world = stubWakala(startingAnOrder);
    openAgency(riders.id);
    openApp(enter(`/start/${groupOrderStep.id}`));
    await heading(groupOrderStep.title);
    expect(where()).toBe(`/a/${riders.id}/start/${groupOrderStep.id}`);
    await userEvent.type(await screen.findByLabelText("Product"), "Urea 50kg");
    await userEvent.type(screen.getByLabelText("Price a bag"), "3600");
    await userEvent.type(screen.getByLabelText("Minimum bags"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(where()).toBe("/coordinator/orders/g1"));
    expect(world.named("market_start_group_order")).toHaveLength(1);
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });

  it("sends the old path to Your agencies while no agency is open", async () => {
    stubWakala(startingAnOrder);
    openApp(`/start/${groupOrderStep.id}`);
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(where()).toBe("/agencies");
  });
});

describe("market: a member goes in by the new path and by the old one", () => {
  it.each(enteredBy)("opens urea, buys now and lands on the order, entering by %s", async (_, enter) => {
    const world = stubWakala(shoppingForUrea);
    const base = `/a/${riders.id}/market`;
    openAgency(riders.id);
    openApp(enter("/market"));
    await heading("Market");
    expect(where()).toBe(base);
    await userEvent.click(await screen.findByRole("button", { name: /Urea/ }));
    await waitFor(() => expect(where()).toBe(`${base}/urea`));
    await userEvent.click(await screen.findByRole("button", { name: "Buy now" }));
    await waitFor(() => expect(where()).toBe(`${base}/urea/buy/o1`));
    await userEvent.type(await screen.findByLabelText("How many bags"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Buy now" }));
    await waitFor(() => expect(where()).toBe(`${base}/orders/or1`));
    expect(await screen.findByText("Kisumu Agro Supplies")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(where()).toBe(base));
    expect(world.named("market_buy_now")).toHaveLength(1);
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });

  it.each([
    ["a product", "/market/urea"],
    ["a buy page", "/market/urea/buy/o1"],
    ["an order", "/market/orders/or1"],
  ])("sends the old path of %s to the same screen in the open agency, keeping the query", async (_, old) => {
    stubWakala(shoppingForUrea);
    openAgency(riders.id);
    openApp(`${old}?yes=y1`);
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}${old}?yes=y1`));
  });

  it("sends the old path to Your agencies while no agency is open", async () => {
    stubWakala(shoppingForUrea);
    openApp("/market/urea");
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(where()).toBe("/agencies");
  });
});

describe("forms: a member goes in by the new path and by the old one", () => {
  beforeEach(() => window.localStorage.clear());

  it.each(enteredBy)("opens a form, sends it and comes back to the list, entering by %s", async (_, enter) => {
    const world = stubWakala(answeringAForm);
    const base = `/a/${riders.id}/forms`;
    openAgency(riders.id);
    openApp(enter("/forms"));
    await heading("Forms");
    expect(where()).toBe(base);
    await userEvent.click(await screen.findByRole("button", { name: /Water levy/ }));
    await waitFor(() => expect(where()).toBe(`${base}/f1`));
    await userEvent.type(await screen.findByLabelText("What do you need"), "A ramp");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Your answers were sent")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to forms" }));
    await waitFor(() => expect(where()).toBe(base));
    expect(world.named("forms_answer_submit")).toHaveLength(1);
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });

  it("sends the old path of a form to the same form in the open agency", async () => {
    stubWakala(answeringAForm);
    openAgency(riders.id);
    openApp("/forms/f1");
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}/forms/f1`));
  });

  it("sends the old path to Your agencies while no agency is open", async () => {
    stubWakala(answeringAForm);
    openApp("/forms");
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(where()).toBe("/agencies");
  });
});

describe("chat: a member goes in by the new path and by the old one", () => {
  it.each(enteredBy)("opens a room, another thread from its Threads card, and comes back to Chat, entering by %s", async (_, enter) => {
    const world = stubWakala(chattingInARoom);
    const base = `/a/${riders.id}/chat`;
    openAgency(riders.id);
    openApp(enter("/chat/r1/t1"));
    await waitFor(() => expect(where()).toBe(`${base}/r1/t1`));
    await userEvent.click(await screen.findByRole("button", { name: /Water levy/ }));
    await waitFor(() => expect(where()).toBe(`${base}/r1/t2`));
    await userEvent.click(await screen.findByRole("button", { name: "‹ Chat" }));
    await waitFor(() => expect(where()).toBe(base));
    await userEvent.click(await screen.findByRole("button", { name: /Siaya farmers/ }));
    await waitFor(() => expect(where()).toMatch(new RegExp(`^${base}/r1/t[12]$`)));
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });

  it("sends the old path of an ask to the same ask in the open agency", async () => {
    stubWakala(chattingInARoom);
    openAgency(riders.id);
    openApp("/chat/r1/t1/asks/a1");
    await waitFor(() => expect(where()).toBe(`/a/${riders.id}/chat/r1/t1/asks/a1`));
  });

  it("sends the old path to Your agencies while no agency is open", async () => {
    stubWakala(chattingInARoom);
    openApp("/chat/r1/t1");
    expect(await screen.findByRole("heading", { name: words.agenciesTitle })).toBeInTheDocument();
    expect(where()).toBe("/agencies");
  });
});
