import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../agency/open";
import { routes } from "../../routes";
import { StartRows } from "../../home/StartRows";
import * as mcp from "../../wakala/mcp";
import { draftOf, isGroupOrderStart, mcpStartClient, unitOf, type PosterChoice, type StartClient, type StartStep } from "./api";
import { StartPage } from "./StartPages";
import { StartWaitingRows } from "./Waiting";

const step: StartStep = {
  id: "w1",
  title: "Start the urea group order",
  formName: "Urea group order",
  roleName: "Group coordinator",
  workflowName: "Create group order",
  opensIn: "form",
  agencyName: "Siaya Farmers' Group",
  questions: [
    { prompt: "Product", answerType: "free_text", helper: "" },
    { prompt: "Price a bag", answerType: "currency", helper: "" },
    { prompt: "Minimum bags", answerType: "number", helper: "" },
  ],
};

const clientOf = (steps: StartStep[], poster: PosterChoice = { kind: "one", poster: { id: "p1", name: "Agro Shop" } }): StartClient & { start: ReturnType<typeof vi.fn> } => ({
  waiting: async () => steps,
  openSteps: async () => steps,
  poster: async () => poster,
  start: vi.fn(async () => ({ id: "g9" })),
});

const startRaw = {
  id: "w1",
  title: "Start the urea group order",
  form_name: "Urea group order",
  role_name: "Group coordinator",
  kind: "fill_form",
  workflow_id: "wf1",
  workflow_name: "Create group order",
  questions: step.questions.map((q) => ({ prompt: q.prompt, answer_type: q.answerType })),
};

const joinRaw = {
  id: "w3",
  title: "Join a group",
  form_name: "Join a group",
  role_name: "Farmer",
  kind: "fill_form",
  workflow_id: "wf2",
  workflow_name: "Join a group",
  questions: [{ prompt: "Group code", answer_type: "free_text", required: false }],
};

const noticeRaw = { id: "w2", title: "Notice", kind: "notify", workflow_id: "wf1", questions: [] };

const joinStep: StartStep = {
  id: "w3",
  title: "Join a group",
  formName: "Join a group",
  roleName: "Farmer",
  workflowName: "Join a group",
  opensIn: "form",
  agencyName: "Siaya Farmers' Group",
  questions: [{ prompt: "Group code", answerType: "free_text", helper: "" }],
};

const withoutAgency = (found: StartStep): StartStep => ({ ...found, agencyName: "" });

const replies = (over: Record<string, any> = {}) =>
  vi.spyOn(mcp, "callTool").mockImplementation(async (_hub: string, tool: string) => {
    if (tool in over) {
      const value = over[tool];
      if (value instanceof Error) throw value;
      return value;
    }
    if (tool === "agency_list_my_open_steps") return { items: [startRaw, noticeRaw] };
    if (tool === "market_list_group_orders") return { items: [] };
    if (tool === "agency_get_agency") return { name: "Siaya Farmers' Group" };
    if (tool === "market_get_group_order_poster") return { poster_id: "p1", poster_name: "Agro Shop", source: "only_approved_poster" };
    return { id: "g1" };
  });

beforeEach(() => openAgency("farmers"));

afterEach(() => {
  vi.restoreAllMocks();
  forgetOpenAgency();
});

describe("the Group coordinator starts the group order", () => {
  it("Start shows the step as a row named by its form and it opens the form", async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<StartRows start={clientOf([step])} />} />
          <Route path={routes.start.pattern} element={<p>form opened</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Urea group order")).toBeInTheDocument();
    expect(screen.queryByText("Waiting on you")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Urea group order"));
    expect(screen.getByText("form opened")).toBeInTheDocument();
  });

  it("the Inbox shows the row and it opens the form", async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<StartWaitingRows client={clientOf([step])} />} />
          <Route path={routes.start.pattern} element={<p>form opened</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByText("Start the urea group order"));
    expect(screen.getByText("form opened")).toBeInTheDocument();
  });

  it("shows nothing when nothing waits", async () => {
    const { container } = render(
      <MemoryRouter>
        <StartRows start={clientOf([])} />
      </MemoryRouter>,
    );
    await act(async () => undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it("the Inbox shows nothing when the waiting read fails", async () => {
    const failing = { ...clientOf([step]), waiting: async () => Promise.reject(new Error("down")) };
    const { container } = render(
      <MemoryRouter>
        <StartWaitingRows client={failing} />
      </MemoryRouter>,
    );
    await act(async () => undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it("the form carries the form's questions and Start sends the answers", async () => {
    const client = clientOf([step]);
    render(
      <MemoryRouter initialEntries={[routes.start.path({ stepId: "w1" })]}>
        <Routes>
          <Route path={routes.start.pattern} element={<StartPage client={client} />} />
          <Route path="/coordinator/orders/:id" element={<p>order opened</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByLabelText("Product"), "Urea 50kg");
    expect(screen.queryByLabelText("Supplier")).not.toBeInTheDocument();
    expect(screen.queryByText("Supplier")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Price a bag"), "3,600");
    await userEvent.type(screen.getByLabelText("Minimum bags"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(client.start).toHaveBeenCalledWith({ product: "Urea 50kg", price: 3600, minimum: 20, posterId: "p1" });
    expect(await screen.findByText("order opened")).toBeInTheDocument();
  });

  it("refuses an empty form without calling the tool", async () => {
    const client = clientOf([step]);
    render(
      <MemoryRouter initialEntries={[routes.start.path({ stepId: "w1" })]}>
        <Routes>
          <Route path={routes.start.pattern} element={<StartPage client={client} />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Start" }));
    expect(screen.getByText("Fill in every field.")).toBeInTheDocument();
    expect(client.start).not.toHaveBeenCalled();
  });

  it("Start shows one row for each waiting step", async () => {
    const second = { ...step, id: "w2", formName: "Maize group order" };
    const { container } = render(
      <MemoryRouter>
        <StartRows start={clientOf([step, second])} />
      </MemoryRouter>,
    );
    await screen.findByText("Maize group order");
    expect(container.querySelectorAll(".rows .row")).toHaveLength(2);
    expect(container.querySelector(".card")).toBeNull();
  });

  it("the Inbox row carries the agency and the role", async () => {
    render(
      <MemoryRouter>
        <StartWaitingRows client={clientOf([step])} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Siaya Farmers' Group · Group coordinator")).toBeInTheDocument();
  });

  it("the form heading is the step's title", async () => {
    render(
      <MemoryRouter initialEntries={[routes.start.path({ stepId: "w1" })]}>
        <Routes>
          <Route path={routes.start.pattern} element={<StartPage client={clientOf([step])} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Start the urea group order" })).toBeInTheDocument();
  });

  it("with several approved posters it asks which and starts from the chosen one", async () => {
    const client = clientOf([step], { kind: "several", posters: [{ id: "p1", name: "Agro Shop" }, { id: "p2", name: "Farm Supply" }] });
    render(
      <MemoryRouter initialEntries={[routes.start.path({ stepId: "w1" })]}>
        <Routes>
          <Route path={routes.start.pattern} element={<StartPage client={client} />} />
          <Route path="/coordinator/orders/:id" element={<p>order opened</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByLabelText("Product"), "Urea 50kg");
    await userEvent.type(screen.getByLabelText("Price a bag"), "3600");
    await userEvent.type(screen.getByLabelText("Minimum bags"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Choose the poster.")).toBeInTheDocument();
    expect(client.start).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText("Supplier"));
    await userEvent.type(screen.getByLabelText("Supplier"), "farm");
    await userEvent.click(screen.getByRole("option", { name: "Farm Supply" }));
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(client.start).toHaveBeenCalledWith({ product: "Urea 50kg", price: 3600, minimum: 20, posterId: "p2" });
  });

  it("with no approved poster there is no form to fill", async () => {
    render(
      <MemoryRouter initialEntries={[routes.start.path({ stepId: "w1" })]}>
        <Routes>
          <Route path={routes.start.pattern} element={<StartPage client={clientOf([step], { kind: "none" })} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("No poster is approved yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
  });

  it("reads the caller's own open steps and starts through the real tool names", async () => {
    const call = replies();
    expect(await mcpStartClient.waiting()).toEqual([step]);
    expect(call).toHaveBeenCalledWith("", "agency_list_my_open_steps", {});
    expect(call).not.toHaveBeenCalledWith("", "agency_list_work_items", expect.anything());
    expect(await mcpStartClient.poster()).toEqual({ kind: "one", poster: { id: "p1", name: "Agro Shop" } });
    await mcpStartClient.start({ product: "Urea 50kg", price: 3600, minimum: 20, posterId: "p1" });
    expect(call).toHaveBeenCalledWith("", "market_start_group_order", { poster_id: "p1", product: "Urea 50kg", price: 3600, minimum: 20 });
  });

  it("waiting leaves out the Join a group step, which openSteps keeps", async () => {
    replies({ agency_list_my_open_steps: { items: [startRaw, joinRaw] } });
    expect(await mcpStartClient.waiting()).toEqual([step]);
    expect((await mcpStartClient.openSteps()).map((found) => found.id)).toEqual(["w1", "w3"]);
  });

  it("when the poster tool refuses over several, it lists the approved posters", async () => {
    replies({
      market_get_group_order_poster: new Error("2 posters are approved, so name the poster_id"),
      market_list_posters: { items: [{ id: "p1", name: "Agro Shop", status: "approved" }, { id: "p2", name: "Farm Supply", status: "approved" }, { id: "p3", name: "Old", status: "pending" }] },
    });
    expect(await mcpStartClient.poster()).toEqual({ kind: "several", posters: [{ id: "p1", name: "Agro Shop" }, { id: "p2", name: "Farm Supply" }] });
  });

  it("when no poster is approved it says none", async () => {
    replies({ market_get_group_order_poster: new Error("not ready"), market_list_posters: { items: [] } });
    expect(await mcpStartClient.poster()).toEqual({ kind: "none" });
  });

  it.each(["open", "revising", "sent", "closed", "cancelled", "done"])("the step stays beside her %s buy group order, so she can have several", async (state) => {
    replies({ market_list_group_orders: { items: [{ id: "g1", direction: "buy", state }] } });
    expect(await mcpStartClient.waiting()).toEqual([step]);
  });

  it("waiting never asks for the group orders", async () => {
    const call = replies({ market_list_group_orders: { items: [{ id: "g1", direction: "buy", state: "open" }] } });
    await mcpStartClient.waiting();
    expect(call).not.toHaveBeenCalledWith("", "market_list_group_orders", expect.anything());
  });

  it.each(["open", "revising", "sent"])("starts a second order from the row while the first is %s", async (state) => {
    const call = replies({ market_list_group_orders: { items: [{ id: "g1", direction: "buy", state }] } });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<StartRows />} />
          <Route path={routes.start.pattern} element={<StartPage />} />
          <Route path="/coordinator/orders/:id" element={<p>second order opened</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByText("Urea group order"));
    await userEvent.type(await screen.findByLabelText("Product"), "DAP 50kg");
    await userEvent.type(screen.getByLabelText("Price a bag"), "4200");
    await userEvent.type(screen.getByLabelText("Minimum bags"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByText("second order opened")).toBeInTheDocument();
    expect(call).toHaveBeenCalledWith("", "market_start_group_order", { poster_id: "p1", product: "DAP 50kg", price: 4200, minimum: 10 });
  });

  it("maps answers to fields by answer type, not by position", () => {
    const reversed = [...step.questions].reverse();
    expect(draftOf(reversed, ["20", "3600", "Urea"])).toEqual({ product: "Urea", price: 3600, minimum: 20 });
  });

  it("derives the unit hint from the answer type", () => {
    expect(unitOf("currency")).toEqual({ unitBefore: "KES" });
    expect(unitOf("number")).toEqual({ unitAfter: "bags" });
    expect(unitOf("free_text")).toEqual({});
    expect(unitOf("")).toEqual({});
  });
});

const inField = (label: string) => screen.getByLabelText(label).closest(".input") as HTMLElement;

const formFor = (questions: StartStep["questions"]) =>
  render(
    <MemoryRouter initialEntries={[routes.start.path({ stepId: "w1" })]}>
      <Routes>
        <Route path={routes.start.pattern} element={<StartPage client={clientOf([{ ...step, questions }])} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the Start form draws what the drawing draws", () => {
  it("puts KES before the currency question and bags after the number question, and no unit on free text", async () => {
    formFor(step.questions);
    await screen.findByLabelText("Product");
    expect(inField("Price a bag").firstElementChild).toHaveTextContent("KES");
    expect(inField("Price a bag").firstElementChild).toHaveClass("unit");
    expect(inField("Minimum bags").lastElementChild).toHaveTextContent("bags");
    expect(inField("Minimum bags").lastElementChild).toHaveClass("unit");
    expect(inField("Product").querySelector(".unit")).toBeNull();
  });

  it("follows the answer type, whatever the questions are called", async () => {
    formFor([
      { prompt: "Item", answerType: "free_text", helper: "" },
      { prompt: "Cost", answerType: "currency", helper: "" },
      { prompt: "Count", answerType: "number", helper: "" },
    ]);
    await screen.findByLabelText("Item");
    expect(inField("Cost").firstElementChild).toHaveTextContent("KES");
    expect(inField("Count").lastElementChild).toHaveTextContent("bags");
    expect(inField("Item").querySelector(".unit")).toBeNull();
  });

  it("draws Supplier as the shared dropdown above Product and marks the chosen supplier", async () => {
    const posters: PosterChoice = { kind: "several", posters: [{ id: "p1", name: "Agro Shop" }, { id: "p2", name: "Farm Supply" }] };
    const { container } = render(
      <MemoryRouter initialEntries={[routes.start.path({ stepId: "w1" })]}>
        <Routes>
          <Route path={routes.start.pattern} element={<StartPage client={clientOf([step], posters)} />} />
        </Routes>
      </MemoryRouter>,
    );
    const supplier = await screen.findByLabelText("Supplier");
    expect(supplier.closest(".search-select")).not.toBeNull();
    expect(supplier.querySelector(".val")?.textContent).toBe("");
    expect(supplier.compareDocumentPosition(screen.getByLabelText("Product")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector(".viewtabs, .viewtab")).toBeNull();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.click(supplier);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Agro Shop", "Farm Supply"]);
    expect(screen.getByRole("option", { name: "Agro Shop" })).toHaveAttribute("aria-selected", "false");
    await userEvent.click(screen.getByRole("option", { name: "Farm Supply" }));
    expect(screen.getByLabelText("Supplier")).toHaveTextContent("Farm Supply");
    await userEvent.click(screen.getByLabelText("Supplier"));
    expect(screen.getByRole("option", { name: "Farm Supply" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Agro Shop" })).toHaveAttribute("aria-selected", "false");
  });

  it("draws No poster is approved yet as the shared empty card", async () => {
    render(
      <MemoryRouter initialEntries={[routes.start.path({ stepId: "w1" })]}>
        <Routes>
          <Route path={routes.start.pattern} element={<StartPage client={clientOf([step], { kind: "none" })} />} />
        </Routes>
      </MemoryRouter>,
    );
    const card = (await screen.findByText("No poster is approved yet.")).closest("section");
    expect(card).toHaveClass("card", "empty");
  });
});

describe("the Start form that cannot open", () => {
  const openStart = (client: StartClient, stepId = "w1") =>
    render(
      <MemoryRouter initialEntries={[routes.start.path({ stepId })]}>
        <Routes>
          <Route path={routes.start.pattern} element={<StartPage client={client} />} />
        </Routes>
      </MemoryRouter>,
    );

  it("announces This task could not be opened. when the waiting steps cannot be read", async () => {
    openStart({ ...clientOf([step]), waiting: async () => Promise.reject(new Error("down")) });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This task could not be opened.");
    expect(alert.closest(".card")).toHaveClass("empty");
  });

  it("announces This task could not be opened. when the step is not among the waiting steps", async () => {
    openStart(clientOf([step]), "w9");
    expect(await screen.findByRole("alert")).toHaveTextContent("This task could not be opened.");
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("announces This task could not be opened. once, with no form, when the step is found but the poster cannot be read", async () => {
    openStart({ ...clientOf([step]), poster: async () => Promise.reject(new Error("down")) });
    expect(await screen.findByRole("alert")).toHaveTextContent("This task could not be opened.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("announces nothing when the step and the poster are both read", async () => {
    openStart(clientOf([step]));
    await screen.findByRole("button", { name: "Start" });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the Start row names the form from the step's data", () => {
  it("shows the form name the step carries, whatever it is", async () => {
    render(
      <MemoryRouter>
        <StartRows start={clientOf([{ ...step, formName: "Group order" }])} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Group order")).toBeInTheDocument();
    expect(screen.queryByText("Urea group order")).not.toBeInTheDocument();
    expect(screen.queryByText("Start the urea group order")).not.toBeInTheDocument();
  });

  it("falls back to the step's title when the step carries no form name", async () => {
    render(
      <MemoryRouter>
        <StartRows start={clientOf([{ ...step, formName: "" }])} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Start the urea group order")).toBeInTheDocument();
  });
});

describe("the Start row in the Inbox", () => {
  it("carries the unread dot first and no time, because the step tool carries none", async () => {
    render(
      <MemoryRouter>
        <StartWaitingRows client={clientOf([step])} />
      </MemoryRouter>,
    );
    const row = (await screen.findByText("Start the urea group order")).closest(".row") as HTMLElement;
    expect(row.firstElementChild).toBe(within(row).getByLabelText("Unread"));
    expect(row.firstElementChild).toHaveClass("dot");
    expect(row.querySelector(".end")).toBeNull();
  });
});

describe("the member's open workflow steps", () => {
  it("openSteps lists the Join a group step alongside the Start step", async () => {
    replies({ agency_list_my_open_steps: { items: [startRaw, joinRaw] } });
    expect(await mcpStartClient.openSteps()).toEqual([withoutAgency(step), withoutAgency(joinStep)]);
  });

  it("openSteps reads the caller's own open steps and never asks for the group orders", async () => {
    const call = replies();
    await mcpStartClient.openSteps();
    expect(call).toHaveBeenCalledWith("", "agency_list_my_open_steps", {});
    expect(call).not.toHaveBeenCalledWith("", "market_list_group_orders", expect.anything());
  });

  it("openSteps and waiting both keep the Start step while a buy group order is live", async () => {
    replies({ market_list_group_orders: { items: [{ id: "g1", direction: "buy", state: "open" }] } });
    expect(await mcpStartClient.openSteps()).toEqual([withoutAgency(step)]);
    expect(await mcpStartClient.waiting()).toEqual([step]);
  });

  it("openSteps drops a step that is not a fill_form, even with questions", async () => {
    replies({
      agency_list_my_open_steps: {
        items: [
          { ...noticeRaw, questions: [{ prompt: "Read it", answer_type: "free_text" }] },
          { ...joinRaw, id: "w4", kind: "yes_no" },
          { ...joinRaw, id: "w5", kind: "send_form" },
        ],
      },
    });
    expect(await mcpStartClient.openSteps()).toEqual([]);
  });

  it("openSteps drops a fill_form step that has no questions", async () => {
    replies({ agency_list_my_open_steps: { items: [{ ...joinRaw, questions: [] }, { ...joinRaw, id: "w6", questions: undefined }] } });
    expect(await mcpStartClient.openSteps()).toEqual([]);
  });

  it("openSteps names each step by the workflow_name the tool carries", async () => {
    replies({ agency_list_my_open_steps: { items: [startRaw, joinRaw] } });
    expect((await mcpStartClient.openSteps()).map((opened) => opened.workflowName)).toEqual(["Create group order", "Join a group"]);
  });

  it("waiting names its step by the workflow_name the tool carries", async () => {
    replies();
    expect((await mcpStartClient.waiting()).map((waiting) => waiting.workflowName)).toEqual(["Create group order"]);
  });

  it("a step whose workflow is gone carries an empty workflow name", async () => {
    replies({ agency_list_my_open_steps: { items: [{ ...joinRaw, workflow_name: "" }, { ...startRaw, id: "w7", workflow_name: undefined }] } });
    expect((await mcpStartClient.openSteps()).map((opened) => opened.workflowName)).toEqual(["", ""]);
  });

  it("openSteps never reads the agency, so its steps name none", async () => {
    const call = replies();
    expect(await mcpStartClient.openSteps()).toEqual([withoutAgency(step)]);
    expect(call).not.toHaveBeenCalledWith("", "agency_get_agency", expect.anything());
  });

  it("waiting still names the agency, which the Inbox row shows", async () => {
    const call = replies();
    expect((await mcpStartClient.waiting()).map((waiting) => waiting.agencyName)).toEqual(["Siaya Farmers' Group"]);
    expect(call).toHaveBeenCalledWith("", "agency_get_agency", {});
  });

  it("openSteps is empty when the member holds no role", async () => {
    replies({ agency_list_my_open_steps: { items: [] } });
    expect(await mcpStartClient.openSteps()).toEqual([]);
  });

  it("waiting still drops a step that is not a fill_form", async () => {
    replies({ agency_list_my_open_steps: { items: [startRaw, noticeRaw] } });
    expect(await mcpStartClient.waiting()).toEqual([step]);
  });
});

describe("telling the group order Start step from the other forms", () => {
  it("is true for the free text, currency and number the group order form asks", () => {
    expect(isGroupOrderStart(step)).toBe(true);
  });

  it("is true whatever order the three questions come in", () => {
    expect(isGroupOrderStart({ ...step, questions: [...step.questions].reverse() })).toBe(true);
  });

  it("is false for the one-question Join a group step", () => {
    expect(isGroupOrderStart(joinStep)).toBe(false);
  });

  it("is false when the currency or the number is missing", () => {
    expect(isGroupOrderStart({ ...step, questions: step.questions.slice(0, 2) })).toBe(false);
    expect(isGroupOrderStart({ ...step, questions: [step.questions[0], step.questions[2]] })).toBe(false);
  });

  it("is false for a step with no questions", () => {
    expect(isGroupOrderStart({ ...step, questions: [] })).toBe(false);
  });
});
