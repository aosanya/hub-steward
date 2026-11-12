import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "../App";
import { forgetOpenAgency } from "../agency/open";
import { agenciesFrom, answerWakala } from "./answerWakala";
import * as mcp from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";

type Row = Record<string, any>;

const siaya = { id: "walk-siaya", name: "Siaya Farmers Group" };
const asha = { id: "hub-asha@mwanachama.test", name: "Asha Otieno" };
const baraka = { id: "hub-baraka@mwanachama.test", name: "Baraka Odhiambo" };
const grace = { id: "qa-owner@mwanachama.test", name: "Grace Adhiambo" };

const modules = [
  { code: "market", name: "Market", enabled: true },
  { code: "forms", name: "Forms", enabled: true },
];

const closedUrea = {
  id: "g1",
  poster_id: "p1",
  coordinator: grace.id,
  direction: "buy",
  product: "urea",
  state: "closed",
  lines: [{ id: "l1", picker: asha.id, quantity: 4 }],
  created_at: "2026-10-20T09:00:00Z",
  closed_at: "2026-11-03T12:00:00Z",
};

const calledOffMaize = {
  id: "g2",
  poster_id: "p1",
  coordinator: asha.id,
  direction: "buy",
  product: "maize seed",
  state: "cancelled",
  lines: [],
  created_at: "2026-10-10T09:00:00Z",
  cancelled_at: "2026-10-28T12:00:00Z",
};

const cancelledSingle = { id: "o7", product: "DAP 50kg", state: "cancelled", cancelled_at: "2026-10-30T12:00:00Z" };

const sentFertilizer = {
  step_id: "s-fert",
  title: "Group fertilizer order",
  form_name: "Fertilizer",
  workflow_name: "Fertilizer for the group",
  row_id: "r1",
  order_id: "run-1",
  sent_at: "2026-11-06T12:00:00Z",
  answers: { Product: "Urea 50kg" },
};

const doneRowsAre = [
  ["Group fertilizer order", "Form · Sent", "Fri 6 Nov"],
  ["urea", "Group order · Closed", "Tue 3 Nov"],
  ["DAP 50kg", "Order · Called off", "Fri 30 Oct"],
  ["maize seed", "Create group order · Called off", "Wed 28 Oct"],
];

const world = (member: { id: string }, finished: boolean) => {
  const calls: Array<[string, Row]> = [];
  const failing = { sentSteps: 0 };
  const reply = async (_hub: string, tool: string, args: Row = {}): Promise<any> => {
    calls.push([tool, args]);
    switch (tool) {
      case "agency_list_instances":
        return { items: [siaya] };
      case "agency_get_agency":
        return { id: siaya.id, name: siaya.name };
      case "agency_list_modules":
        return { items: modules };
      case "agency_get_my_roles":
        return { instance_id: siaya.id, membership: "resident", roles: [] };
      case "agency_list_my_sent_steps":
        if (failing.sentSteps > 0) {
          failing.sentSteps -= 1;
          throw new Error("the agency is not answering");
        }
        return { items: finished ? [sentFertilizer] : [] };
      case "market_list_group_orders":
        if (args.state === "closed") return { items: finished ? [closedUrea] : [] };
        if (args.state === "cancelled") return { items: finished ? [calledOffMaize] : [] };
        return { items: [] };
      case "market_list_orders":
        if (args.state === "cancelled") return { items: finished ? [cancelledSingle] : [] };
        return { items: [] };
      case "market_get_group_order":
        return { ...closedUrea, lines: closedUrea.lines.filter((line) => line.picker === member.id) };
      case "actor_list_actors":
        return { items: [grace, asha, baraka].map(({ id, name }) => ({ id, display_name: name })) };
      default:
        return { items: [] };
    }
  };
  return { reply, calls, failing, called: (tool: string) => calls.filter(([name]) => name === tool).map(([, args]) => args) };
};

type World = ReturnType<typeof world>;

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

let shown: ReturnType<typeof render> | undefined;

const sessionOf = (member: { id: string }, finished: boolean): World => {
  const fakes = world(member, finished);
  forgetSubject();
  forgetOpenAgency();
  vi.stubGlobal("fetch", answerWakala(() => member.id, agenciesFrom(fakes.reply as any)));
  vi.spyOn(mcp, "callTool").mockImplementation(fakes.reply as any);
  return fakes;
};

const opensOngoing = () => {
  shown?.unmount();
  shown = render(
    <MemoryRouter initialEntries={[`/a/${siaya.id}/ongoing`]}>
      <App />
      <Where />
    </MemoryRouter>,
  );
};

const where = () => screen.getByTestId("where").textContent ?? "";

const opensDone = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Done" }));
};

const rowsShown = () =>
  Array.from(document.querySelectorAll<HTMLElement>(".rows .row")).map((row) =>
    Array.from(row.querySelectorAll(".ttl, .meta")).map((part) => part.textContent ?? ""),
  );

afterEach(() => {
  shown?.unmount();
  shown = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  forgetSubject();
  forgetOpenAgency();
});

describe("Ongoing, Done tab", () => {
  it("shows a member on a fresh session her finished orders and sent forms, newest first, and reads nothing finished until she opens Done", async () => {
    const fakes = sessionOf(asha, true);
    opensOngoing();
    expect(await screen.findByText("Nothing ongoing yet")).toBeInTheDocument();
    expect(fakes.called("agency_list_my_sent_steps")).toEqual([]);
    expect(fakes.called("market_list_orders")).toEqual([]);

    await opensDone();
    await screen.findByText("Group fertilizer order");
    expect(rowsShown()).toEqual(doneRowsAre);
    expect(screen.queryByText("Nothing ongoing yet")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(fakes.called("market_list_group_orders")).toEqual(
      expect.arrayContaining([
        { mine: true, state: "closed", limit: 20 },
        { mine: true, state: "cancelled", limit: 20 },
      ]),
    );
  });

  it("opens a finished order to read and leaves a sent form as a plain row", async () => {
    sessionOf(asha, true);
    opensOngoing();
    await opensDone();
    const form = (await screen.findByText("Group fertilizer order")).closest(".row") as HTMLElement;
    expect(form.tagName).toBe("DIV");
    expect(within(form).queryByRole("button")).toBeNull();

    await userEvent.click(screen.getByText("urea"));
    expect(where()).toBe("/my-orders/group/g1");
  });

  it("tells a member who has finished nothing so, with no button to press", async () => {
    sessionOf(baraka, false);
    opensOngoing();
    await opensDone();
    const line = await screen.findByText("Nothing finished yet");
    expect(line.closest("section")).toHaveClass("empty");
    expect(within(line.closest("section") as HTMLElement).queryByRole("button")).toBeNull();
  });

  it("says some could not be loaded when her sent forms fail, shows the orders, and brings the forms in on Try again", async () => {
    const fakes = sessionOf(asha, true);
    fakes.failing.sentSteps = 1;
    opensOngoing();
    await opensDone();
    await screen.findByText("urea");
    expect(screen.getByRole("alert")).toHaveTextContent("Some of your finished tasks could not be loaded.");
    expect(screen.queryByText("Group fertilizer order")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Group fertilizer order");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(rowsShown()).toEqual(doneRowsAre);
    expect(fakes.called("agency_list_my_sent_steps")).toHaveLength(2);
    expect(fakes.called("market_list_group_orders").filter((args) => args.state === "closed")).toHaveLength(1);
  });

  it("goes back to Live from Done", async () => {
    sessionOf(asha, true);
    opensOngoing();
    await opensDone();
    await screen.findByText("urea");
    await userEvent.click(screen.getByRole("button", { name: "Live" }));
    expect(await screen.findByText("Nothing ongoing yet")).toBeInTheDocument();
    expect(screen.queryByText("urea")).toBeNull();
  });
});
