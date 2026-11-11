import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { dateTimeWords } from "../../ui/days";
import { taskTools } from "../../backlogs/api";
import { capsTools } from "../../backlogs/caps/api";
import { referenceTools } from "../../backlogs/references/api";
import { beforeEachJourney, endInAgencies, importIssue, inFarmers } from "./backlogs.test-support";

beforeEach(beforeEachJourney);

afterEach(endInAgencies);

type Numbers = { input_tokens: number; output_tokens: number; runtime_seconds: number };

type Used = { input_tokens: number; output_tokens: number; seconds_used: number; clock_stopped: boolean; updated_at?: string };

const standard: Numbers = { input_tokens: 500000, output_tokens: 100000, runtime_seconds: 900 };

const reading = (own: Numbers | null, used?: Used) => {
  const forced = {
    input_tokens: own?.input_tokens || standard.input_tokens,
    output_tokens: own?.output_tokens || standard.output_tokens,
    runtime_seconds: own?.runtime_seconds || standard.runtime_seconds,
  };
  return { task_id: "t1", default: standard, in_force: forced, ...(own ? { own } : {}), ...(used ? { used } : {}) };
};

const worldWith = (start: { own?: Numbers | null; used?: Used } = {}) => {
  let own: Numbers | null = start.own ?? null;
  return {
    [capsTools.read]: () => reading(own, start.used),
    [capsTools.set]: (args: Record<string, unknown>) => {
      own = {
        input_tokens: Number(args.input_tokens ?? own?.input_tokens ?? 0),
        output_tokens: Number(args.output_tokens ?? own?.output_tokens ?? 0),
        runtime_seconds: Number(args.runtime_seconds ?? own?.runtime_seconds ?? 0),
      };
      return reading(own, start.used);
    },
    [capsTools.clear]: () => {
      own = null;
      return reading(own, start.used);
    },
    [referenceTools.list]: () => ({ items: [] }),
  };
};

const section = async () => {
  const card = (await screen.findByText("Caps")).closest("section") as HTMLElement;
  const head = within(card).getByRole("button", { name: "Caps" });
  if (head.getAttribute("aria-expanded") === "false") await userEvent.click(head);
  return card;
};

const lineOf = (card: HTMLElement, label: string) => within(card).getByText(label).closest(".cap-line") as HTMLElement;

const typeInto = async (card: HTMLElement, label: string, text: string) => {
  const field = within(card).getByLabelText(label);
  await userEvent.clear(field);
  if (text !== "") await userEvent.type(field, text);
};

describe("journey 10, the Caps card on an issue", () => {
  it("sits between References and Log and shows the default numbers with the words for all workers", async () => {
    inFarmers("/backlogs/issue/t1", worldWith());
    const card = await section();
    expect(await within(card).findByText("0 / 500,000 tokens")).toBeInTheDocument();
    expect(within(lineOf(card, "Input tokens")).getByText("0 / 500,000 tokens")).toBeInTheDocument();
    expect(within(lineOf(card, "Output tokens")).getByText("0 / 100,000 tokens")).toBeInTheDocument();
    expect(within(lineOf(card, "Runtime")).getByText("0:00 / 15:00")).toBeInTheDocument();
    expect(within(card).getByText("Default for all workers")).toBeInTheDocument();
    const titles = Array.from(document.querySelectorAll(".issue-side .card-title")).map((one) => one.textContent);
    expect(titles.indexOf("References")).toBeLessThan(titles.indexOf("Caps"));
    expect(titles.indexOf("Caps")).toBeLessThan(titles.indexOf("Log"));
  });

  it("reads the caps and the consumption with the one call", async () => {
    const world = inFarmers("/backlogs/issue/t1", worldWith());
    await within(await section()).findByText("0 / 500,000 tokens");
    expect(world.named(capsTools.read).map((call) => call.args.taskID)).toEqual(["t1"]);
  });

  it("starts shut like References and Log, shows only its name, and opens on a tap", async () => {
    inFarmers("/backlogs/issue/t1", worldWith());
    const card = (await screen.findByText("Caps")).closest("section") as HTMLElement;
    const head = within(card).getByRole("button", { name: "Caps" });
    expect(head).toHaveAttribute("aria-expanded", "false");
    expect(within(card).queryByText("Input tokens")).toBeNull();
    await userEvent.click(head);
    expect(await within(card).findByText("0 / 500,000 tokens")).toBeInTheDocument();
    await userEvent.click(head);
    expect(within(card).queryByText("0 / 500,000 tokens")).toBeNull();
  });

  it("says an issue's own numbers are its own and shows the default beside them", async () => {
    inFarmers("/backlogs/issue/t1", worldWith({ own: { input_tokens: 800000, output_tokens: 150000, runtime_seconds: 1500 } }));
    const card = await section();
    expect(await within(card).findByText("0 / 800,000 tokens")).toBeInTheDocument();
    expect(within(lineOf(card, "Runtime")).getByText("0:00 / 25:00")).toBeInTheDocument();
    expect(within(card).getByText("This issue's own numbers · the default is 500,000 · 100,000 · 15 min")).toBeInTheDocument();
  });

  it("marks the caps that fall back to the default when only some are the issue's own", async () => {
    inFarmers("/backlogs/issue/t1", worldWith({ own: { input_tokens: 800000, output_tokens: 0, runtime_seconds: 1500 } }));
    const card = await section();
    await within(card).findByText("0 / 800,000 tokens");
    expect(within(lineOf(card, "Output tokens")).getByText("Default")).toBeInTheDocument();
    expect(within(lineOf(card, "Input tokens")).queryByText("Default")).toBeNull();
    expect(within(card).getByText("Some numbers are this issue's own · the default is 500,000 · 100,000 · 15 min")).toBeInTheDocument();
  });

  it("shows used of cap, a bar and the percent, and marks the highest percent Nearest", async () => {
    inFarmers("/backlogs/issue/t1", worldWith({ used: { input_tokens: 312400, output_tokens: 41200, seconds_used: 680, clock_stopped: false } }));
    const card = await section();
    const input = lineOf(card, "Input tokens");
    expect(await within(input).findByText("312,400 / 500,000 tokens")).toBeInTheDocument();
    expect(within(input).getByText("62% used")).toBeInTheDocument();
    expect(within(input).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    expect(within(lineOf(card, "Output tokens")).getByText("41,200 / 100,000 tokens")).toBeInTheDocument();
    expect(within(lineOf(card, "Runtime")).getByText("11:20 / 15:00")).toBeInTheDocument();
    expect(within(lineOf(card, "Runtime")).getByText("76% used")).toBeInTheDocument();
    expect(within(card).getAllByText("Nearest")).toHaveLength(1);
    expect(within(lineOf(card, "Runtime")).getByText("Nearest")).toBeInTheDocument();
  });

  it("shows 200,222 / 500,000 tokens for a card with consumption, and the runtime of 200 seconds as 3:20 / 15:00", async () => {
    inFarmers("/backlogs/issue/t1", worldWith({ used: { input_tokens: 200222, output_tokens: 12480, seconds_used: 200, clock_stopped: false } }));
    const card = await section();
    expect(await within(lineOf(card, "Input tokens")).findByText("200,222 / 500,000 tokens")).toBeInTheDocument();
    expect(within(lineOf(card, "Output tokens")).getByText("12,480 / 100,000 tokens")).toBeInTheDocument();
    expect(within(lineOf(card, "Runtime")).getByText("3:20 / 15:00")).toBeInTheDocument();
  });

  it("shows 0 / cap, an empty bar and 0% used on every line when no worker has run, and nothing is Nearest", async () => {
    inFarmers("/backlogs/issue/t1", worldWith());
    const card = await section();
    await within(card).findByText("0 / 500,000 tokens");
    for (const label of ["Input tokens", "Output tokens", "Runtime"]) {
      const line = lineOf(card, label);
      expect(within(line).getByText("0% used")).toBeInTheDocument();
      expect(within(line).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    }
    expect(within(card).queryByText("Nearest")).toBeNull();
    expect(within(card).queryByText(/^updated /)).toBeNull();
  });

  it("says when the consumption was last updated, only while a run is on record", async () => {
    inFarmers("/backlogs/issue/t1", worldWith({ used: { input_tokens: 200222, output_tokens: 12480, seconds_used: 200, clock_stopped: false, updated_at: "2026-11-11T19:20:00Z" } }));
    const card = await section();
    await within(card).findByText("200,222 / 500,000 tokens");
    expect(within(card).getByText(`updated ${dateTimeWords("2026-11-11T19:20:00Z")}`)).toBeInTheDocument();
  });

  it("asks again every 15 seconds while the issue is in progress, and never when it is not", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const world = inFarmers("/backlogs/issue/t1", { ...worldWith({ used: { input_tokens: 100, output_tokens: 10, seconds_used: 5, clock_stopped: false } }), [taskTools.get]: () => ({ ...importIssue, state: "Doing" }) });
      await within(await section()).findByText("100 / 500,000 tokens");
      const before = world.named(capsTools.read).length;
      await vi.advanceTimersByTimeAsync(15_000);
      expect(world.named(capsTools.read).length).toBe(before + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not ask again when no worker runs", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const world = inFarmers("/backlogs/issue/t1", worldWith());
      await within(await section()).findByText("0 / 500,000 tokens");
      const before = world.named(capsTools.read).length;
      await vi.advanceTimersByTimeAsync(45_000);
      expect(world.named(capsTools.read).length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks the passed cap Passed with a full bar", async () => {
    inFarmers("/backlogs/issue/t1", worldWith({ used: { input_tokens: 100, output_tokens: 100000, seconds_used: 60, clock_stopped: false } }));
    const card = await section();
    const output = lineOf(card, "Output tokens");
    expect(await within(output).findByText("Passed")).toBeInTheDocument();
    expect(within(output).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(within(lineOf(card, "Input tokens")).queryByText("Passed")).toBeNull();
  });

  it("shows Paused, waiting for your answer on the runtime line while the clock is stopped", async () => {
    inFarmers("/backlogs/issue/t1", worldWith({ used: { input_tokens: 312400, output_tokens: 41200, seconds_used: 680, clock_stopped: true } }));
    const card = await section();
    expect(await within(lineOf(card, "Runtime")).findByText("Paused, waiting for your answer")).toBeInTheDocument();
    expect(within(lineOf(card, "Input tokens")).queryByText("Paused, waiting for your answer")).toBeNull();
  });

  it("says the caps could not be read when the call fails", async () => {
    inFarmers("/backlogs/issue/t1", {
      ...worldWith(),
      [capsTools.read]: () => {
        throw new Error("down");
      },
    });
    const card = await section();
    expect(await within(card).findByText("The caps could not be read.")).toBeInTheDocument();
  });
});

describe("journey 10, step 7, gives one issue its own numbers", () => {
  it("opens three fields in the card with the numbers in force, the runtime in minutes", async () => {
    inFarmers("/backlogs/issue/t1", worldWith());
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Edit" }));
    expect(within(card).getByLabelText("Input tokens")).toHaveValue("500000");
    expect(within(card).getByLabelText("Output tokens")).toHaveValue("100000");
    expect(within(card).getByLabelText("Runtime in minutes")).toHaveValue("15");
    expect(within(card).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Use the default" })).toBeInTheDocument();
  });

  it("Save keeps the three as the issue's own, the runtime sent in seconds, and the card says so", async () => {
    const world = inFarmers("/backlogs/issue/t1", worldWith());
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Edit" }));
    await typeInto(card, "Input tokens", "800000");
    await typeInto(card, "Output tokens", "150000");
    await typeInto(card, "Runtime in minutes", "25");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(await within(card).findByText("This issue's own numbers · the default is 500,000 · 100,000 · 15 min")).toBeInTheDocument();
    expect(world.named(capsTools.set).map((call) => call.args)).toEqual([expect.objectContaining({ taskID: "t1", input_tokens: 800000, output_tokens: 150000, runtime_seconds: 1500 })]);
    expect(world.named(capsTools.clear)).toHaveLength(0);
    expect(within(lineOf(card, "Input tokens")).getByText("0 / 800,000 tokens")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("Use the default removes the issue's own numbers and the card says the default again", async () => {
    const world = inFarmers("/backlogs/issue/t1", worldWith({ own: { input_tokens: 800000, output_tokens: 150000, runtime_seconds: 1500 } }));
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Edit" }));
    await userEvent.click(within(card).getByRole("button", { name: "Use the default" }));
    expect(await within(card).findByText("Default for all workers")).toBeInTheDocument();
    expect(world.named(capsTools.clear).map((call) => call.args.taskID)).toEqual(["t1"]);
    expect(within(lineOf(card, "Input tokens")).getByText("0 / 500,000 tokens")).toBeInTheDocument();
  });

  it("an emptied number falls back to the default while the others stay the issue's own", async () => {
    const world = inFarmers("/backlogs/issue/t1", worldWith({ own: { input_tokens: 800000, output_tokens: 150000, runtime_seconds: 1500 } }));
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Edit" }));
    await typeInto(card, "Output tokens", "");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(await within(card).findByText("Some numbers are this issue's own · the default is 500,000 · 100,000 · 15 min")).toBeInTheDocument();
    expect(world.named(capsTools.clear)).toHaveLength(1);
    expect(world.named(capsTools.set).map((call) => call.args)).toEqual([expect.objectContaining({ input_tokens: 800000, runtime_seconds: 1500 })]);
    expect(world.named(capsTools.set)[0].args).not.toHaveProperty("output_tokens");
    expect(within(lineOf(card, "Output tokens")).getByText("0 / 100,000 tokens")).toBeInTheDocument();
    expect(within(lineOf(card, "Output tokens")).getByText("Default")).toBeInTheDocument();
  });

  it("all three emptied is the same as Use the default", async () => {
    const world = inFarmers("/backlogs/issue/t1", worldWith({ own: { input_tokens: 800000, output_tokens: 150000, runtime_seconds: 1500 } }));
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Edit" }));
    await typeInto(card, "Input tokens", "");
    await typeInto(card, "Output tokens", "");
    await typeInto(card, "Runtime in minutes", "");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(await within(card).findByText("Default for all workers")).toBeInTheDocument();
    expect(world.named(capsTools.clear)).toHaveLength(1);
    expect(world.named(capsTools.set)).toHaveLength(0);
  });

  it.each([
    ["0", "Input tokens"],
    ["-5", "Output tokens"],
    ["1.5", "Runtime in minutes"],
    ["ten", "Input tokens"],
  ])("a number %s in %s is refused in place and nothing is sent", async (typed, label) => {
    const world = inFarmers("/backlogs/issue/t1", worldWith());
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Edit" }));
    await typeInto(card, label, typed);
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(await within(card).findByText("A whole number above zero.")).toBeInTheDocument();
    expect(world.named(capsTools.set)).toHaveLength(0);
    expect(world.named(capsTools.clear)).toHaveLength(0);
  });

  it("says in place when the hub refuses the change and keeps the fields open", async () => {
    inFarmers("/backlogs/issue/t1", {
      ...worldWith(),
      [capsTools.set]: () => {
        throw new Error("no");
      },
    });
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Edit" }));
    await typeInto(card, "Input tokens", "700000");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    expect(await within(card).findByText("The caps could not be saved.")).toBeInTheDocument();
    expect(within(card).getByLabelText("Input tokens")).toHaveValue("700000");
  });

  it("Cancel closes the fields without a call", async () => {
    const world = inFarmers("/backlogs/issue/t1", worldWith());
    const card = await section();
    await userEvent.click(await within(card).findByRole("button", { name: "Edit" }));
    await typeInto(card, "Input tokens", "1");
    await userEvent.click(within(card).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(within(card).queryByLabelText("Input tokens")).toBeNull());
    expect(world.named(capsTools.set)).toHaveLength(0);
    expect(within(lineOf(card, "Input tokens")).getByText("0 / 500,000 tokens")).toBeInTheDocument();
  });
});
