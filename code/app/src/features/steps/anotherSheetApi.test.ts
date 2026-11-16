import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency, openAgency } from "../../shared/wakala/openAgency";
import { mcpStepsClient } from "./api";
import { forgetSent } from "./sent";

const fetched = (body: unknown) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status: 201 }));

beforeEach(() => openAgency("hub1"));

afterEach(() => {
  vi.restoreAllMocks();
  forgetSent();
  forgetOpenAgency();
});

describe("sending another sheet of a record step", () => {
  it("posts the answers with the run, another_sheet true and the new send key", async () => {
    const fetch = fetched({ order_id: "o1", done: false, next_step: null });
    await mcpStepsClient.submit({ id: "s8", state: "start", orderId: "" }, { Who: "Bela" }, "k2", { orderId: "o1" });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ answers: { Who: "Bela" }, order_id: "o1", another_sheet: true, send_key: "k2" });
  });
});
