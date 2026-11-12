import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { openAgency } from "../agency/open";
import { answerWakala } from "../journeys/answerWakala";
import { App } from "../App";
import * as mcp from "../wakala/mcp";
import { forgetSubject } from "../wakala/me";

const hub = "hub-1";

const startStep = {
  id: "s1",
  title: "Start the urea group order",
  kind: "fill_form",
  role_name: "Group coordinator",
  form_name: "Urea group order",
  questions: [
    { prompt: "Product", answer_type: "free_text" },
    { prompt: "Price", answer_type: "currency" },
    { prompt: "Minimum", answer_type: "number" },
  ],
};

const joinStep = {
  id: "s2",
  title: "Join a group",
  kind: "fill_form",
  role_name: "Farmer",
  form_name: "Join a group",
  questions: [{ prompt: "Group code", answer_type: "free_text" }],
};

const beganOrder = { id: "g1", poster_id: "p1", coordinator: "m1", direction: "buy", product: "urea", state: "open", lines: [] };

type Modules = () => Promise<unknown>;

type Replies = { agency?: () => Promise<unknown>; steps?: unknown[]; orders?: unknown[] };

const answering = (modules: Modules, replies: Replies = {}) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_hub: string, tool: string) => {
    switch (tool) {
      case "agency_list_mounts":
        return modules();
      case "agency_get_agency":
        return (replies.agency ?? (async () => ({ id: hub, name: "Alego Growers" })))();
      case "agency_list_my_open_steps":
        return { items: replies.steps ?? [startStep] };
      case "market_list_group_orders":
        return { items: replies.orders ?? [] };
      case "market_list_posters":
      case "actor_list_my_invitations":
      case "actor_list_my_join_requests":
      case "comm_notification_list":
        return { items: [] };
      case "agency_get_my_roles":
        return { membership: "member", roles: [] };
      default:
        throw new Error(`no answer for ${tool}`);
    }
  }) as never);

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

const where = () => screen.getByTestId("where").textContent;

const goHome = async () => userEvent.click(await screen.findByRole("link", { name: /Home/ }));

const startRowTitles = () => Array.from(document.querySelectorAll<HTMLElement>("main > .rows > .row .ttl")).map((title) => title.textContent);

const openAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  openAgency(hub);
  forgetSubject();
  vi.stubGlobal("fetch", answerWakala(() => "m1", () => [{ id: hub, name: "Alego Growers" }]));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  forgetSubject();
});

const modulesThatSay: Array<[string, Modules]> = [
  ["fails", async () => Promise.reject(new Error("down"))],
  ["returns no modules", async () => ({ modules: [] })],
  ["returns other modules only", async () => ({ modules: [{ module: "chat", mounts: [{ name: "Chat", key: "main" }] }] })],
  ["returns no list at all", async () => ({})],
  ["never answers", () => new Promise<never>(() => undefined)],
];

describe("the Create group order row on Start, whatever the module read says", () => {
  it.each(modulesThatSay)("is drawn when agency_list_mounts %s", async (_name, modules) => {
    answering(modules);
    openAt(`/a/${hub}/do-something`);
    expect(await screen.findByText("Urea group order")).toBeInTheDocument();
    expect(startRowTitles()[0]).toBe("Urea group order");
    expect(screen.queryByText("Waiting on you")).not.toBeInTheDocument();
  });

  it("is drawn when the agency's own read fails too", async () => {
    answering(async () => Promise.reject(new Error("down")), { agency: async () => Promise.reject(new Error("down")) });
    openAt(`/a/${hub}/do-something`);
    expect(await screen.findByText("Urea group order")).toBeInTheDocument();
  });

  it("is drawn while the module read has not answered, beside the loading line", async () => {
    answering(() => new Promise<never>(() => undefined));
    openAt(`/a/${hub}/do-something`);
    expect(await screen.findByText("Urea group order")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading your agency");
  });

  it("opens the Start form from the row", async () => {
    answering(async () => ({ modules: [] }));
    openAt(`/a/${hub}/do-something`);
    await userEvent.click(await screen.findByText("Urea group order"));
    expect(await screen.findByRole("heading", { name: startStep.title })).toBeInTheDocument();
    expect(where()).toBe(`/a/${hub}/start/${startStep.id}`);
  });

  it.each(["open", "revising"])("stays while her %s group order is live, so she can start another", async (state) => {
    answering(async () => ({ modules: [] }), { orders: [{ ...beganOrder, state }] });
    openAt(`/a/${hub}/do-something`);
    expect(await screen.findByText("Urea group order")).toBeInTheDocument();
    expect(startRowTitles()[0]).toBe("Urea group order");
  });
});

describe("Do Something and the Home badge read the same waiting steps", () => {
  it("draw the one step on both when the module read says nothing", async () => {
    answering(async () => ({ modules: [] }));
    openAt(`/a/${hub}/do-something`);
    expect(await screen.findByText("Urea group order")).toBeInTheDocument();
    await goHome();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(await within(nav).findByLabelText("1 unread notifications")).toBeInTheDocument();
    expect(await screen.findByText(startStep.title)).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByLabelText("1 unread notifications")).toBeInTheDocument();
  });

  it("reads the steps for the Start row, again for the badge once Home is back, and once for the other Start rows, which callTool answers from one request", async () => {
    const call = answering(async () => ({ modules: [] }));
    openAt(`/a/${hub}/do-something`);
    await screen.findByText("Urea group order");
    await goHome();
    expect(await screen.findByLabelText("1 unread notifications")).toBeInTheDocument();
    expect(call.mock.calls.filter(([, tool, args]) => tool === "agency_list_my_open_steps" && !args?.available)).toHaveLength(4);
    expect(call.mock.calls.filter(([, tool, args]) => tool === "agency_list_my_open_steps" && args?.available === true)).toHaveLength(2);
  });

  it("make one read of the waiting steps on the home screen for its badge, and one each of the open and available steps for its options", async () => {
    const call = answering(async () => ({ modules: [] }));
    openAt(`/a/${hub}/home`);
    await screen.findByText(startStep.title);
    expect(await screen.findByLabelText("1 unread notifications")).toBeInTheDocument();
    expect(call.mock.calls.filter(([, tool]) => tool === "agency_list_my_open_steps")).toHaveLength(3);
  });
});

describe("a workflow step that is not the group order Start", () => {
  it("is a row of the Start tab after the Create group order row", async () => {
    answering(async () => ({ modules: [] }), { steps: [startStep, joinStep] });
    openAt(`/a/${hub}/do-something`);
    const join = await screen.findByRole("button", { name: /^Join a group/ });
    expect(startRowTitles()).toEqual(["Urea group order", "Join a group"]);
    await userEvent.click(join);
    expect(where()).toBe(`/a/${hub}/join`);
  });

  it("counts for no unread badge on Home", async () => {
    answering(async () => ({ modules: [] }), { steps: [joinStep] });
    openAt(`/a/${hub}/do-something`);
    await screen.findByRole("button", { name: /^Join a group/ });
    await goHome();
    expect(screen.queryByLabelText(/unread notifications/)).not.toBeInTheDocument();
  });
});

const chooseOngoing = async () => userEvent.click(await screen.findByRole("link", { name: /Ongoing/ }));

describe("the order she began", () => {
  it("is listed in the Ongoing rows with its workflow and state", async () => {
    answering(async () => ({ modules: [] }), { orders: [beganOrder] });
    openAt(`/a/${hub}/do-something`);
    await chooseOngoing();
    expect(await screen.findByText("Create group order · Open")).toBeInTheDocument();
    expect(screen.getByText(beganOrder.product)).toBeInTheDocument();
    expect(screen.queryByText("Urea group order")).not.toBeInTheDocument();
  });

  it("is not listed on Start, which keeps the Create group order row", async () => {
    answering(async () => ({ modules: [] }), { orders: [beganOrder] });
    openAt(`/a/${hub}/do-something`);
    expect(await screen.findByText("Urea group order")).toBeInTheDocument();
    expect(screen.queryByText("Create group order · Open")).not.toBeInTheDocument();
  });
});

describe("Ongoing on the Do Something page", () => {
  it("opens on Start and leaves the agency name to the top bar", async () => {
    answering(async () => ({ modules: [] }));
    openAt(`/a/${hub}/do-something`);
    expect(await screen.findByText("Urea group order")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start/ })).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("main")).queryByText("Alego Growers")).toBeNull();
  });

  it("offers Go to Start when nothing is ongoing, and Start comes back with its rows", async () => {
    answering(async () => ({ modules: [] }));
    openAt(`/a/${hub}/do-something`);
    await chooseOngoing();
    expect(await screen.findByText("Nothing ongoing yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go to Start" }));
    expect(screen.getByRole("link", { name: /Start/ })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("Urea group order")).toBeInTheDocument();
    expect(where()).toBe(`/a/${hub}/do-something`);
  });

  it("opens an Ongoing row where the work left off, and back from it lands on Ongoing", async () => {
    answering(async () => ({ modules: [] }), { orders: [beganOrder] });
    openAt(`/a/${hub}/do-something`);
    await chooseOngoing();
    await userEvent.click(await screen.findByText("Create group order · Open"));
    expect(where()).toBe(`/coordinator/orders/${beganOrder.id}`);
    expect(screen.getByRole("link", { name: /Ongoing/ })).toHaveAttribute("aria-current", "page");
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(where()).toBe(`/a/${hub}/ongoing`);
    expect(await screen.findByRole("link", { name: /Ongoing/ })).toHaveAttribute("aria-current", "page");
  });
});
