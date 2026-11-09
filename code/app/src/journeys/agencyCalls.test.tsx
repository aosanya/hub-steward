import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openAgency, openAgencyId } from "../agency/open";
import { groupTools } from "../groups/api";
import { answeringAForm, chattingInARoom, endInAgencies, everyCallNames, farmers, groupOrderStep, openApp, riders, shoppingForUrea, startInAgencies, startingAnOrder, stubWakala } from "./inAgency.test-support";

beforeEach(startInAgencies);

afterEach(endInAgencies);

describe("join: every call names the agency in the address", () => {
  it("asks to join in the agency of the address, not in the one opened before", async () => {
    const world = stubWakala({
      [groupTools.listJoinable]: () => ({ items: [{ id: "g1", name: "Siaya farmers", public_code: "G-S7F-4KM-2RX", join_mode: "confirmed" }] }),
    });
    openAgency(farmers.id);
    openApp(`/a/${riders.id}/join`);
    expect(await screen.findByText("Siaya farmers")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ask to join" }));
    await screen.findByRole("button", { name: "Requested" });
    expect(world.named(groupTools.join)).toHaveLength(1);
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });
});

describe("start: every call names the agency in the address", () => {
  it("starts a group order in the agency of the address, not in the one opened before", async () => {
    const world = stubWakala(startingAnOrder);
    openAgency(farmers.id);
    openApp(`/a/${riders.id}/start/${groupOrderStep.id}`);
    await userEvent.type(await screen.findByLabelText("Product"), "Urea 50kg");
    await userEvent.type(screen.getByLabelText("Price a bag"), "3600");
    await userEvent.type(screen.getByLabelText("Minimum bags"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(world.named("market_start_group_order")).toHaveLength(1));
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });
});

describe("market: every call names the agency in the address", () => {
  it("lists the market, opens a product and buys now in the agency of the address, not in the one opened before", async () => {
    const world = stubWakala(shoppingForUrea);
    openAgency(farmers.id);
    openApp(`/a/${riders.id}/market`);
    await userEvent.click(await screen.findByRole("button", { name: /Urea/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Buy now" }));
    await userEvent.type(await screen.findByLabelText("How many bags"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Buy now" }));
    await waitFor(() => expect(world.named("market_buy_now")).toHaveLength(1));
    await screen.findByText("Kisumu Agro Supplies");
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });
});

describe("forms: every call names the agency in the address", () => {
  beforeEach(() => window.localStorage.clear());

  it("lists the forms, opens one and sends it in the agency of the address, not in the one opened before", async () => {
    const world = stubWakala(answeringAForm);
    openAgency(farmers.id);
    openApp(`/a/${riders.id}/forms`);
    await userEvent.click(await screen.findByRole("button", { name: /Water levy/ }));
    await userEvent.type(await screen.findByLabelText("What do you need"), "A ramp");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await waitFor(() => expect(world.named("forms_answer_submit")).toHaveLength(1));
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });
});

describe("chat: every call names the agency in the address", () => {
  it("opens a room, writes in it and opens another of its threads in the agency of the address, not in the one opened before", async () => {
    const world = stubWakala(chattingInARoom);
    openAgency(farmers.id);
    openApp(`/a/${riders.id}/chat/r1/t1`);
    await userEvent.type(await screen.findByLabelText("Write to Siaya farmers"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(world.named("comm_chat_message_post")).toHaveLength(1));
    await userEvent.click(await screen.findByRole("button", { name: /Water levy/ }));
    await screen.findByRole("heading", { name: "Water levy" });
    everyCallNames(world.sent, riders);
    expect(openAgencyId()).toBe(riders.id);
  });

  it("opens an ask of a room in the agency of the address", async () => {
    const world = stubWakala(chattingInARoom);
    openAgency(farmers.id);
    openApp(`/a/${riders.id}/chat/r1/t1/asks/a1`);
    await screen.findByRole("heading", { name: "Ask" });
    await waitFor(() => expect(world.named("market_list_asks").length).toBeGreaterThan(0));
    everyCallNames(world.sent, riders);
  });
});
