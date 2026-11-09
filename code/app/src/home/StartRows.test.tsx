import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { AgencyView } from "../agency/modules";
import { forgetOpenAgency, openAgency } from "../agency/open";
import { isGroupOrderStart, startPath, type StartStep } from "../coordinator/start/api";
import { homeCardsFor, type AgencyKind } from "./cards";
import { StartRows } from "./StartRows";
import { chatTab } from "../tabs";
import { chatListPath } from "../routes";
import { applySupplierPath, applySupplierWorkflow, buyInputsChatPath, buyInputsChatWorkflow, joinGroupWorkflow, sellHarvestChatPath, sellHarvestChatWorkflow } from "./workflowScreens";

const kinds: AgencyKind[] = ["farmers", "supplier"];

const step = (over: Partial<StartStep>): StartStep => ({
  id: "s1",
  title: "",
  formName: "",
  roleName: "Farmer",
  workflowName: "",
  opensIn: "form",
  agencyName: "Alego Growers",
  questions: [{ prompt: "Question", answerType: "free_text", helper: "" }],
  ...over,
});

const chatStep = (id: string, workflowName: string) => step({ id, title: "Chat with an agent", workflowName, opensIn: "chat", questions: [] });

const buyChat = chatStep("c1", buyInputsChatWorkflow);
const sellChat = chatStep("c2", sellHarvestChatWorkflow);

const groupOrderStart = step({
  id: "g1",
  title: "Start the urea group order",
  formName: "Urea group order",
  roleName: "Group coordinator",
  questions: [
    { prompt: "Product", answerType: "free_text", helper: "" },
    { prompt: "Price", answerType: "currency", helper: "" },
    { prompt: "Minimum", answerType: "number", helper: "" },
  ],
});

const joinGroup = step({ id: "j1", title: "Join", formName: joinGroupWorkflow });
const applySupplier = step({ id: "a1", title: "Apply", formName: applySupplierWorkflow });
const report = step({ id: "r1", title: "Report a problem", formName: "Problem report" });

const startOf = (openSteps: () => Promise<StartStep[]>, waiting: () => Promise<StartStep[]> = async () => []) => ({ openSteps, waiting });

const stepsOf = (steps: StartStep[]) => startOf(async () => steps, async () => steps.filter(isGroupOrderStart));

const holdsAForm = {
  waiting: async () => [{ form_id: "f1", title: "Survey", closes_at: "", questions: 1, answered: false, unanswered_as: [] }],
  answered: async () => [],
};

const view = (codes: string[]): AgencyView => ({ name: "Alego Growers", modules: codes.map((code) => ({ code, name: `${code} app` })) });

let landed = "";

const Where = () => {
  landed = useLocation().pathname;
  return null;
};

const show = async (props: Parameters<typeof StartRows>[0]) => {
  landed = "";
  let shown: ReturnType<typeof render> | undefined;
  await act(async () => {
    shown = render(
      <MemoryRouter>
        <StartRows forms={holdsAForm} {...props} />
        <Where />
      </MemoryRouter>,
    );
  });
  return shown!;
};

const rowElements = () => Array.from(document.querySelectorAll<HTMLElement>(".rows .row"));

const titleOf = (row: HTMLElement) => row.querySelector(".ttl")?.textContent ?? "";

const titlesShown = () => rowElements().map(titleOf);

const pathOf = async (row: HTMLElement) => {
  await userEvent.click(row);
  return landed;
};

const rowsShown = async () => {
  const shown: Array<[string, string]> = [];
  for (const row of rowElements()) shown.push([titleOf(row), await pathOf(row)]);
  return shown;
};

const rowNamed = (title: string) => screen.findByRole("button", { name: new RegExp(`^${title}`) });

beforeEach(() => openAgency("farmers"));

afterEach(() => forgetOpenAgency());

describe("the Start rows of Do Something", () => {
  describe("the rows of the agency's cards", () => {
    it.each(kinds)("draws one row for each card of the %s agency, each to its path", async (kind) => {
      await show({ kind, start: stepsOf([]) });
      const cards = homeCardsFor(kind).map((card) => [card.title, card.path]);
      expect(await rowsShown()).toEqual(cards);
    });

    it("gives the supplier the market cards, the prices and the forms", async () => {
      await show({ kind: "supplier", start: stepsOf([]) });
      expect(titlesShown()).toEqual(["Offers", "Asks", "Group order", "Orders", "Your prices", "Forms"]);
    });

    it("draws the cards the agency's modules leave on, and names Forms as the agency does", async () => {
      await show({ kind: "farmers", view: { name: "Alego Growers", modules: [{ code: "forms", name: "Paperwork" }] }, start: stepsOf([]) });
      expect(await rowsShown()).toEqual([["Paperwork", "/a/farmers/forms"]]);
    });

    it("leaves out the market cards when the agency has the market switched off", async () => {
      await show({ kind: "supplier", view: view(["forms"]), start: stepsOf([]) });
      expect(await rowsShown()).toEqual([["forms app", "/a/farmers/forms"]]);
    });

    it("draws a Risks row to the risk screens when the agency has the riskmanager module", async () => {
      await show({ kind: "farmers", view: view(["riskmanager"]), start: stepsOf([]) });
      expect(await rowsShown()).toEqual([["Risks", "/a/farmers/risks"]]);
    });

    it("draws no Join a group or Apply as a supplier row of its own, since they are workflow steps", async () => {
      await show({ kind: "farmers", start: stepsOf([]) });
      expect(screen.queryByRole("button", { name: /^(Join|Apply)/ })).not.toBeInTheDocument();
    });
  });

  describe("the Forms card", () => {
    const waitingForm = { form_id: "f1", title: "Survey", closes_at: "", questions: 1, answered: false, unanswered_as: [] };
    const answeredForm = { send_id: "s1", form_id: "f1", title: "Survey", closes_at: "", open: false, answered_at: "" };
    const formsOf = (waiting: unknown[], answered: unknown[]) => ({ waiting: async () => waiting as never[], answered: async () => answered as never[] });
    const noForms = { waiting: async () => Promise.reject(new Error("down")), answered: async () => Promise.reject(new Error("down")) };

    it("is left out for a member who has no form waiting and none answered, so a role with one step sees only that step", async () => {
      await show({ kind: "farmers", start: stepsOf([]), forms: formsOf([], []) });
      expect(titlesShown()).toEqual([]);
      expect(screen.getByText("Nothing to start yet")).toBeInTheDocument();
    });

    it("stays for a member with a form waiting", async () => {
      await show({ kind: "farmers", start: stepsOf([]), forms: formsOf([waitingForm], []) });
      expect(titlesShown()).toEqual(["Forms"]);
    });

    it("stays for a member who has answered a form", async () => {
      await show({ kind: "farmers", start: stepsOf([]), forms: formsOf([], [answeredForm]) });
      expect(titlesShown()).toEqual(["Forms"]);
    });

    it("stays when the forms cannot be read, since nothing says there are none", async () => {
      await show({ kind: "farmers", start: stepsOf([]), forms: noForms });
      expect(titlesShown()).toEqual(["Forms"]);
    });

    it("leaves the other cards and the member's own step where they are", async () => {
      await show({ kind: "supplier", start: stepsOf([joinGroup]), forms: formsOf([], []) });
      await rowNamed(joinGroupWorkflow);
      expect(titlesShown()).toEqual(["Offers", "Asks", "Group order", "Orders", "Your prices", joinGroupWorkflow]);
    });
  });

  describe("a row is plain", () => {
    it("is a button with a title and the chevron, no lead mark, no icon, no line and no link", async () => {
      await show({ kind: "farmers", start: stepsOf([groupOrderStart, joinGroup]) });
      await rowNamed(joinGroupWorkflow);
      expect(screen.queryAllByRole("link")).toEqual([]);
      for (const row of rowElements()) {
        expect(row.tagName).toBe("BUTTON");
        expect(row.querySelector(".lead")).toBeNull();
        expect(row.querySelector("svg")).toBeNull();
        expect(row.querySelector(".meta")).toBeNull();
        expect(row.querySelector(".end")).toHaveTextContent("›");
      }
    });

    it("draws the rows in one list", async () => {
      await show({ kind: "farmers", start: stepsOf([joinGroup]) });
      await rowNamed(joinGroupWorkflow);
      expect(document.querySelectorAll(".rows")).toHaveLength(1);
    });
  });

  describe("the row of a chat workflow", () => {
    const adviceChat = chatStep("c9", "Plant advice");

    it("is read from the open steps by the workflow's name, and a farmers' agency with no chat workflow draws none", async () => {
      await show({ kind: "farmers", start: stepsOf([adviceChat]) });
      await rowNamed("Plant advice");
      expect(titlesShown()).toEqual(["Plant advice", "Forms"]);
      cleanup();
      await show({ kind: "farmers", start: stepsOf([]) });
      expect(titlesShown()).toEqual(["Forms"]);
    });

    it("carries the chat mark in the row's lead slot, before the name, and no other row carries a mark", async () => {
      await show({ kind: "farmers", start: stepsOf([adviceChat, joinGroup, groupOrderStart]) });
      await rowNamed("Plant advice");
      const marked = rowElements().filter((row) => row.querySelector(".mark") !== null);
      expect(marked.map(titleOf)).toEqual(["Plant advice"]);
      const mark = marked[0].querySelector(".mark")!;
      expect(marked[0].firstElementChild).toBe(mark);
      expect(mark.querySelector("svg")).toHaveAttribute("data-icon", chatTab.icon);
      expect(mark).toHaveAttribute("aria-hidden", "true");
    });

    it("is chosen by the workflow's type: a form workflow with a name gets no chat row and no mark", async () => {
      await show({ kind: "farmers", start: stepsOf([step({ id: "f9", workflowName: "Plant advice", opensIn: "form", formName: "" })]) });
      expect(titlesShown()).toEqual(["Forms"]);
      expect(document.querySelector(".mark")).toBeNull();
    });

    it("draws one row for a workflow that holds several chat steps, and one for each workflow", async () => {
      await show({ kind: "farmers", start: stepsOf([adviceChat, { ...adviceChat, id: "c10" }, chatStep("c11", "Weather advice")]) });
      await rowNamed("Plant advice");
      expect(titlesShown()).toEqual(["Plant advice", "Weather advice", "Forms"]);
    });

    it("draws no row for a chat step whose workflow has no name", async () => {
      await show({ kind: "farmers", start: stepsOf([chatStep("c12", "")]) });
      expect(titlesShown()).toEqual(["Forms"]);
    });

    it("opens the app's own chat screen when the workflow has one, and the Chat tab when it has none", async () => {
      await show({ kind: "farmers", start: stepsOf([buyChat, sellChat, adviceChat]) });
      await rowNamed(buyInputsChatWorkflow);
      expect(await rowsShown()).toEqual([
        [buyInputsChatWorkflow, buyInputsChatPath],
        [sellHarvestChatWorkflow, sellHarvestChatPath],
        ["Plant advice", chatTab.path],
        ["Forms", "/a/farmers/forms"],
      ]);
    });
  });

  describe("the rows of the steps she has open", () => {
    it("adds a row for each open step after the card rows, named for its form", async () => {
      await show({ kind: "farmers", start: stepsOf([buyChat, sellChat, joinGroup, applySupplier]) });
      await rowNamed(joinGroupWorkflow);
      expect(titlesShown()).toEqual([buyInputsChatWorkflow, sellHarvestChatWorkflow, "Forms", joinGroupWorkflow, applySupplierWorkflow]);
    });

    it("draws the Start step of the group order first, named by its form, and opens its start page", async () => {
      await show({ kind: "farmers", start: stepsOf([buyChat, sellChat, joinGroup, groupOrderStart]) });
      await rowNamed(joinGroupWorkflow);
      expect(titlesShown()).toEqual([groupOrderStart.formName, buyInputsChatWorkflow, sellHarvestChatWorkflow, "Forms", joinGroupWorkflow]);
      expect(await pathOf(await rowNamed(groupOrderStart.formName))).toBe(startPath("g1"));
      expect(screen.queryByRole("button", { name: /^Start the urea group order/ })).not.toBeInTheDocument();
    });

    it("names the Start step by its title when the step carries no form name", async () => {
      await show({ start: stepsOf([{ ...groupOrderStart, formName: "" }]) });
      expect(await pathOf(await rowNamed(groupOrderStart.title))).toBe(startPath("g1"));
      expect(titlesShown()).toEqual([groupOrderStart.title]);
    });

    it("draws no Waiting on you line under the Start step", async () => {
      await show({ kind: "farmers", start: stepsOf([groupOrderStart]) });
      await rowNamed(groupOrderStart.formName);
      expect(screen.queryByText("Waiting on you")).not.toBeInTheDocument();
    });

    it("draws no row for the Start step when she holds no such step", async () => {
      await show({ kind: "farmers", start: stepsOf([buyChat, sellChat, joinGroup, applySupplier]) });
      await rowNamed(joinGroupWorkflow);
      expect(titlesShown()).toEqual([buyInputsChatWorkflow, sellHarvestChatWorkflow, "Forms", joinGroupWorkflow, applySupplierWorkflow]);
    });

    it("draws one row for each waiting Start step", async () => {
      const second = { ...groupOrderStart, id: "g2", formName: "Maize group order" };
      await show({ start: stepsOf([groupOrderStart, second]) });
      await rowNamed(second.formName);
      expect(await rowsShown()).toEqual([
        [groupOrderStart.formName, startPath("g1")],
        [second.formName, startPath("g2")],
      ]);
    });

    it("draws it before the agency has answered which kind it is, and before the open steps have loaded", async () => {
      await show({ start: startOf(() => new Promise<StartStep[]>(() => undefined), async () => [groupOrderStart]) });
      await rowNamed(groupOrderStart.formName);
      expect(titlesShown()).toEqual([groupOrderStart.formName]);
    });

    it("draws it when the open steps cannot be read, beside the alert", async () => {
      await show({ start: startOf(async () => Promise.reject(new Error("down")), async () => [groupOrderStart]) });
      await rowNamed(groupOrderStart.formName);
      expect(await screen.findByRole("alert")).toHaveTextContent("Your apps could not be loaded.");
    });

    it("draws the cards without it when the waiting steps cannot be read", async () => {
      await show({ kind: "farmers", start: startOf(async () => [buyChat, sellChat], async () => Promise.reject(new Error("down"))) });
      await rowNamed(buyInputsChatWorkflow);
      expect(titlesShown()).toEqual([buyInputsChatWorkflow, sellHarvestChatWorkflow, "Forms"]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("puts it above the cards when it arrives after them", async () => {
      let arrive: (steps: StartStep[]) => void = () => undefined;
      const pending = new Promise<StartStep[]>((resolve) => {
        arrive = resolve;
      });
      await show({ kind: "farmers", start: startOf(async () => [buyChat, sellChat], () => pending) });
      await rowNamed(buyInputsChatWorkflow);
      expect(titlesShown()).toEqual([buyInputsChatWorkflow, sellHarvestChatWorkflow, "Forms"]);
      await act(async () => arrive([groupOrderStart]));
      expect(titlesShown()).toEqual([groupOrderStart.formName, buyInputsChatWorkflow, sellHarvestChatWorkflow, "Forms"]);
    });

    it("opens the Join a group step on the join screen", async () => {
      await show({ kind: "farmers", start: stepsOf([joinGroup]) });
      expect(await pathOf(await rowNamed(joinGroupWorkflow))).toBe("/a/farmers/join");
    });

    it("opens the Apply as a supplier step on the application screen", async () => {
      await show({ kind: "farmers", start: stepsOf([applySupplier]) });
      expect(await pathOf(await rowNamed(applySupplierWorkflow))).toBe(applySupplierPath);
    });

    it("draws no row for a step that has no screen of its own, and keeps the rows of the steps that have one", async () => {
      await show({ kind: "farmers", start: stepsOf([buyChat, sellChat, joinGroup, applySupplier, report]) });
      await rowNamed(joinGroupWorkflow);
      expect(screen.queryByRole("button", { name: /^Problem report/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Report a problem/ })).not.toBeInTheDocument();
      expect(titlesShown()).toEqual([buyInputsChatWorkflow, sellHarvestChatWorkflow, "Forms", joinGroupWorkflow, applySupplierWorkflow]);
    });

    it("opens a start page for the Start step of the group order and for no other step", async () => {
      await show({ kind: "farmers", start: stepsOf([joinGroup, report, groupOrderStart, applySupplier]) });
      await rowNamed(joinGroupWorkflow);
      expect((await rowsShown()).filter(([, path]) => path.startsWith("/a/farmers/start/"))).toEqual([[groupOrderStart.formName, startPath("g1")]]);
    });

    it("draws no row for a step with neither a form name nor a title", async () => {
      await show({ kind: "farmers", start: stepsOf([step({ id: "e1", title: "", formName: "" })]) });
      expect(titlesShown()).toEqual(["Forms"]);
    });

    it("draws no row for a step with a title but no form name", async () => {
      await show({ kind: "farmers", start: stepsOf([step({ id: "t1", title: "Report a problem", formName: "" })]) });
      expect(titlesShown()).toEqual(["Forms"]);
    });

    it("draws no row for a form named like a workflow but not exactly", async () => {
      const lookalikes = ["join a group", "Join a group ", "constructor", "toString"].map((formName, at) => step({ id: `l${at}`, formName }));
      await show({ start: stepsOf(lookalikes) });
      expect(titlesShown()).toEqual([]);
    });

    it("draws the workflow rows of the lab, which has no cards", async () => {
      await show({ start: stepsOf([joinGroup]) });
      expect(await pathOf(await rowNamed(joinGroupWorkflow))).toBe("/a/farmers/join");
      expect(rowElements()).toHaveLength(1);
    });

    it("draws the step rows before the agency has answered which kind it is", async () => {
      await show({ start: stepsOf([joinGroup]) });
      await rowNamed(joinGroupWorkflow);
      expect(rowElements()).toHaveLength(1);
    });

    it("draws one row when two open steps lead to the same screen", async () => {
      await show({ start: stepsOf([joinGroup, { ...joinGroup, id: "j2" }]) });
      await rowNamed(joinGroupWorkflow);
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("reads the open steps once and the waiting steps once", async () => {
      const openSteps = vi.fn(async () => [joinGroup]);
      const waiting = vi.fn(async () => [groupOrderStart]);
      await show({ kind: "farmers", start: startOf(openSteps, waiting) });
      await rowNamed(joinGroupWorkflow);
      expect(openSteps).toHaveBeenCalledTimes(1);
      expect(waiting).toHaveBeenCalledTimes(1);
    });
  });

  describe("while the steps load, when they cannot be read, and with nothing to show", () => {
    it("draws the card rows at once and adds the step rows when they arrive", async () => {
      let arrive: (steps: StartStep[]) => void = () => undefined;
      const pending = new Promise<StartStep[]>((resolve) => {
        arrive = resolve;
      });
      await show({ kind: "farmers", start: startOf(() => pending) });
      expect(titlesShown()).toEqual(["Forms"]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await act(async () => arrive([buyChat, sellChat, joinGroup]));
      await rowNamed(joinGroupWorkflow);
      expect(titlesShown()).toEqual([buyInputsChatWorkflow, sellHarvestChatWorkflow, "Forms", joinGroupWorkflow]);
    });

    it("keeps the card rows and says the apps could not be loaded when the steps could not be read", async () => {
      await show({ kind: "farmers", start: startOf(async () => Promise.reject(new Error("down"))) });
      expect(await screen.findByRole("alert")).toHaveTextContent("Your apps could not be loaded.");
      expect(titlesShown()).toEqual(["Forms"]);
    });

    it("says only that the apps could not be loaded when there are no cards either", async () => {
      const { container } = await show({ start: startOf(async () => Promise.reject(new Error("down"))) });
      expect(await screen.findByRole("alert")).toHaveTextContent("Your apps could not be loaded.");
      expect(container.querySelector(".rows")).toBeNull();
    });

    it("announces the failed read as an alert inside the empty failure card", async () => {
      await show({ start: startOf(async () => Promise.reject(new Error("down"))) });
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Your apps could not be loaded.");
      expect(alert.closest(".card")).toHaveClass("empty");
    });

    it("carries its act in a card when nothing is left to start: Ask in Chat opens the Chat tab", async () => {
      const { container } = await show({ kind: "farmers", view: view([]), start: stepsOf([]) });
      expect(await screen.findByText("Nothing to start yet")).toBeInTheDocument();
      expect(container.querySelector(".rows")).toBeNull();
      expect(screen.getByText("Nothing to start yet").closest(".card")).toHaveClass("empty");
      await userEvent.click(screen.getByRole("button", { name: "Ask in Chat" }));
      expect(landed).toBe(chatListPath());
    });

    it("does not draw the empty card while the steps load, when they cannot be read, or when a row is shown", async () => {
      const pending = new Promise<StartStep[]>(() => undefined);
      const loading = await show({ kind: "farmers", view: view([]), start: startOf(() => pending) });
      expect(screen.queryByText("Nothing to start yet")).not.toBeInTheDocument();
      loading.unmount();
      const failed = await show({ kind: "farmers", view: view([]), start: startOf(async () => Promise.reject(new Error("down"))) });
      await screen.findByRole("alert");
      expect(screen.queryByText("Nothing to start yet")).not.toBeInTheDocument();
      failed.unmount();
      await show({ kind: "farmers", view: view(["forms"]), start: stepsOf([]) });
      expect(screen.queryByText("Nothing to start yet")).not.toBeInTheDocument();
    });

    it("renders nothing at all when there are no rows and no error", async () => {
      const openSteps = vi.fn(async () => []);
      const { container } = await show({ start: startOf(openSteps) });
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing while the lab's steps are still loading", async () => {
      const { container } = await show({ start: startOf(() => new Promise<StartStep[]>(() => undefined)) });
      expect(container).toBeEmptyDOMElement();
    });

    it("draws only the Start row when only the group order Start step is open for the lab", async () => {
      await show({ start: stepsOf([groupOrderStart]) });
      await rowNamed(groupOrderStart.formName);
      expect(titlesShown()).toEqual([groupOrderStart.formName]);
    });

    it("renders nothing when only steps without a screen of their own are open for the lab", async () => {
      const openSteps = vi.fn(async () => [report, { ...report, id: "r2" }, step({ id: "e1" })]);
      const { container } = await show({ start: startOf(openSteps) });
      await act(async () => undefined);
      expect(openSteps).toHaveBeenCalledTimes(1);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
