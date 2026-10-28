import { modelMenu, providerOf, targetOf } from "./catalog";

const claude = providerOf("claude")!;
const meta = providerOf("meta")!;
const huggingFace = providerOf("huggingface")!;

describe("the models a dropdown offers", () => {
  it("are the standard ones alone while nothing was read from the key", () => {
    const menu = modelMenu(claude, []);

    expect(menu.fromKey).toEqual([]);
    expect(menu.current).toEqual([]);
    expect(menu.standard.map((o) => o.value)).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1"]);
    expect(menu.standard[1].label).toBe("Sonnet 5.5 (claude-sonnet-5-5)");
  });

  it("put the ids the provider listed that the standard list does not name under From your key", () => {
    const menu = modelMenu(claude, ["claude-haiku-5-5", "claude-sonnet-5-6", "claude-haiku-5-6"]);

    expect(menu.fromKey).toEqual([
      { value: "claude-sonnet-5-6", label: "claude-sonnet-5-6" },
      { value: "claude-haiku-5-6", label: "claude-haiku-5-6" },
    ]);
  });

  it("name an id the standard list already names once, in the standard group", () => {
    const menu = modelMenu(claude, ["claude-opus-5-5", "claude-sonnet-5-5"]);

    expect(menu.fromKey).toEqual([]);
    expect(menu.standard.filter((o) => o.value === "claude-opus-5-5")).toHaveLength(1);
    const everything = [...menu.current, ...menu.fromKey, ...menu.standard].map((o) => o.value);
    expect(new Set(everything).size).toBe(everything.length);
  });

  it("list an id twice read once", () => {
    expect(modelMenu(meta, ["muse-spark-open", "muse-spark-open", "muse-spark-pro"]).fromKey.map((o) => o.value)).toEqual(["muse-spark-open", "muse-spark-pro"]);
  });

  it("offer every listed id for a provider with no standard models", () => {
    const menu = modelMenu(providerOf("custom")!, ["my-org/llama-4", "my-org/llama-5"]);

    expect(menu.standard).toEqual([]);
    expect(menu.fromKey.map((o) => o.value)).toEqual(["my-org/llama-4", "my-org/llama-5"]);
  });

  it("offer the five Muse Spark models of Meta Model API as the standard list, and leave them out of From your key", () => {
    const menu = modelMenu(meta, ["muse-spark-1.3", "muse-spark-1.4", "muse-spark-1.2-contributor"]);

    expect(menu.standard.map((o) => o.value)).toEqual([
      "muse-spark-1.3",
      "muse-spark-1.2",
      "muse-spark-1.1",
      "muse-spark-1.3-contributor",
      "muse-spark-1.2-contributor",
    ]);
    expect(menu.fromKey.map((o) => o.value)).toEqual(["muse-spark-1.4"]);
  });

  it("keep a chosen id the list does not hold as an option of its own", () => {
    expect(modelMenu(claude, ["claude-sonnet-5-6"], "claude-next").current).toEqual([{ value: "claude-next", label: "claude-next" }]);
    expect(modelMenu(meta, [], "Muse-Spark-Open").current).toEqual([{ value: "Muse-Spark-Open", label: "Muse-Spark-Open" }]);
    expect(modelMenu(meta, [], "muse-spark-1.3").current).toEqual([]);
  });

  it("keep nothing extra for an id the standard list or the key's list holds, or for nothing chosen, or for Other model", () => {
    expect(modelMenu(claude, [], "claude-opus-5-5").current).toEqual([]);
    expect(modelMenu(claude, ["claude-sonnet-5-6"], "claude-sonnet-5-6").current).toEqual([]);
    expect(modelMenu(claude, [], "").current).toEqual([]);
    expect(modelMenu(claude, [], "other").current).toEqual([]);
  });

  it("keep a chosen id when a refreshed list no longer holds it", () => {
    expect(modelMenu(huggingFace, ["x/new"], "x/old").current.map((o) => o.value)).toEqual(["x/old"]);
  });
});

describe("what a key was saved for", () => {
  it("is the provider alone for Hugging Face and Claude, however an address got there", () => {
    expect(targetOf({ provider: "claude", base: "https://x.example/v1" })).toEqual({ provider: "claude", base: undefined });
    expect(targetOf({ provider: "huggingface" })).toEqual({ provider: "huggingface", base: undefined });
  });

  it("is the provider and the address for Meta Model API and Other, without slashes at the end", () => {
    expect(targetOf({ provider: "meta", base: " https://api.meta.ai/v1/ " })).toEqual({ provider: "meta", base: "https://api.meta.ai/v1" });
    expect(targetOf({ provider: "custom", base: "https://llm.example.org/v1" })).toEqual({ provider: "custom", base: "https://llm.example.org/v1" });
  });

});
