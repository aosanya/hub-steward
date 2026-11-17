import { afterEach, describe, expect, it, vi } from "vitest";
import { mcpStepsClient } from "../../steps/api";
import { needsYouCount } from "../../inbox/needsYou";
import * as mcp from "../../../shared/wakala/mcp";
import { mcpStartClient } from "./api";

const titles = [
  "Talajminta felvétele",
  "Vízóra leolvasása",
  "Közterület bejárása",
  "Játszótér ellenőrzése",
  "Faültetési kérelem",
  "Hulladékgyűjtési naptár",
  "Lomtalanítási igény",
  "Közvilágítás hibabejelentés",
  "Parkolási engedély",
  "Rendezvény bejelentése",
  "Temetői díj egyeztetése",
  "Havi jelentés leadása",
];

const workflows = ["Környezetvédelem", "Közterületek", "Hulladékgazdálkodás", "Engedélyek", "Pénzügyek"];

const openStep = (index: number, over: Record<string, unknown> = {}) => ({
  id: `dh-step-${index + 1}`,
  kind: "fill_form",
  opens_in: "form",
  title: titles[index],
  form_name: `Űrlap ${index + 1}`,
  role_name: "Department head",
  workflow_name: workflows[index % workflows.length],
  state: "start",
  questions: [{ prompt: `Kérdés ${index + 1}`, answer_type: "free_text", helper: "" }],
  ...over,
});

const twelveOpenSteps = titles.map((_title, index) => openStep(index));

const hubReplies = (open: object[], available: object[]) =>
  vi.spyOn(mcp, "callTool").mockImplementation((async (_agency: string, tool: string, args: Record<string, unknown> = {}) => {
    if (tool === "agency_list_my_open_steps") return { items: args.available === true ? available : open };
    if (tool === "agency_get_agency") return { name: "Zöldhalom" };
    if (tool === "agency_list_my_sent_steps") return { items: [] };
    throw new Error(`no answer for ${tool}`);
  }) as never);

const nothingElseWaiting = { invitations: [], items: [] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the phone Home for a Department head who holds twelve open steps that are all starts", () => {
  const threeStarts = twelveOpenSteps.slice(0, 3);

  it("lists no waiting step, because none is a group order start and none waits on her", async () => {
    hubReplies(twelveOpenSteps, threeStarts);
    expect(await mcpStartClient.waiting()).toEqual([]);
  });

  it("counts zero things to do, so the You have N things to do strip stays hidden", async () => {
    hubReplies(twelveOpenSteps, threeStarts);
    const steps = await mcpStartClient.waiting();
    expect(needsYouCount({ steps, ...nothingElseWaiting })).toBe(0);
  });

  it("offers her three available steps, every one a start rather than a waiting step", async () => {
    hubReplies(twelveOpenSteps, threeStarts);
    const available = await mcpStepsClient.available();
    expect(available.map((step) => [step.id, step.state])).toEqual([
      ["dh-step-1", "start"],
      ["dh-step-2", "start"],
      ["dh-step-3", "start"],
    ]);
  });

  it("still reads all twelve open steps across the five workflows", async () => {
    hubReplies(twelveOpenSteps, threeStarts);
    const steps = await mcpStartClient.openSteps();
    expect(steps).toHaveLength(12);
    expect(new Set(steps.map((step) => step.workflowName)).size).toBe(5);
    expect(steps.every((step) => step.opensIn === "form")).toBe(true);
  });
});

describe("the same Department head once one available step waits on her", () => {
  const waitingOnHer = openStep(2, { state: "waiting", order_id: "o1" });
  const available = [twelveOpenSteps[0], twelveOpenSteps[1], waitingOnHer];

  it("lists exactly that one waiting step with its order", async () => {
    hubReplies(twelveOpenSteps, available);
    const steps = await mcpStartClient.waiting();
    expect(steps.map((step) => [step.id, step.orderId])).toEqual([["dh-step-3", "o1"]]);
  });

  it("counts one thing to do, so the strip shows", async () => {
    hubReplies(twelveOpenSteps, available);
    const steps = await mcpStartClient.waiting();
    expect(needsYouCount({ steps, ...nothingElseWaiting })).toBe(1);
  });
});
