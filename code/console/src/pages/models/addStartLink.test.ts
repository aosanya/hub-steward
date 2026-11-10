import { describe, expect, it } from "vitest";
import { addPathOf, addStartOfQuery } from "./addStartLink";
import { providerOf } from "./catalog";

describe("the link that opens Add a model with a start chosen", () => {
  it("is the plain add page with no start", () => {
    expect(addPathOf("hub 1")).toBe("/h/hub%201/models/new");
  });

  it("carries the provider and model, and the base only when one is given", () => {
    expect(addPathOf("h1", { provider: "meta", model: "muse-spark-1.3" })).toBe("/h/h1/models/new?provider=meta&model=muse-spark-1.3");
    expect(addPathOf("h1", { provider: "meta", model: "m", base: "https://x.test/v1" })).toBe("/h/h1/models/new?provider=meta&model=m&base=https%3A%2F%2Fx.test%2Fv1");
  });

  it("keeps an empty base, so a cleared address stays cleared", () => {
    expect(addPathOf("h1", { provider: "meta", model: "m", base: "" })).toContain("base=");
  });
});

describe("reading the start back from the address", () => {
  it("is nothing for a missing or unknown provider", () => {
    expect(addStartOfQuery(new URLSearchParams(""))).toBeUndefined();
    expect(addStartOfQuery(new URLSearchParams("provider=nobody&model=x"))).toBeUndefined();
  });

  it("falls back to the provider's own preselected model and base", () => {
    const meta = providerOf("meta")!;
    expect(addStartOfQuery(new URLSearchParams("provider=meta"))).toEqual({ provider: "meta", model: meta.preselected, base: meta.baseURL });
  });

  it("uses what the address says over the defaults", () => {
    expect(addStartOfQuery(new URLSearchParams("provider=meta&model=custom&base=https%3A%2F%2Fx.test%2Fv1"))).toEqual({ provider: "meta", model: "custom", base: "https://x.test/v1" });
  });

  it("round-trips what addPathOf wrote", () => {
    const start = { provider: "meta", model: "muse-spark-1.3", base: "https://x.test/v1" };
    const query = new URLSearchParams(addPathOf("h1", start).split("?")[1]);
    expect(addStartOfQuery(query)).toEqual(start);
  });
});
