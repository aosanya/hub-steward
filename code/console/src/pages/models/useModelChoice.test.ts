import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { otherModel } from "./catalog";
import { useModelChoice } from "./useModelChoice";

const choose = (start?: { provider: string; model: string; base?: string }) => renderHook(() => useModelChoice(start));

describe("starting with nothing chosen", () => {
  it("has no provider, nothing complete and no target", () => {
    const { result } = choose();

    expect(result.current.provider).toBeUndefined();
    expect(result.current.complete).toBe(false);
    expect(result.current.target).toBeNull();
    expect(result.current.keyChoice).toBeNull();
    expect(result.current.changed).toBe(false);
  });
});

describe("choosing a provider with a fixed address", () => {
  it("is not complete until a model is chosen, and keeps no address of its own", () => {
    const { result } = choose();

    act(() => result.current.setProvider("claude"));

    expect(result.current.provider?.id).toBe("claude");
    expect(result.current.model).toBe("");
    expect(result.current.complete).toBe(false);
    expect(result.current.addressReady).toBe(true);
    expect(result.current.keyChoice).toEqual({ provider: "claude", base: undefined });
    expect(result.current.target).toEqual({ provider: "claude", base: undefined });
  });

  it("is complete once a model is chosen, named by that model", () => {
    const { result } = choose();

    act(() => result.current.setProvider("claude"));
    act(() => result.current.setModel("claude-sonnet-5-5"));

    expect(result.current.complete).toBe(true);
    expect(result.current.choice).toEqual({ provider: "claude", name: "claude-sonnet-5-5", base: undefined });
    expect(result.current.keyChoice).toEqual(result.current.choice);
    expect(result.current.showsName).toBe(false);
  });
});

describe("choosing a provider with an address of the person's own", () => {
  it("fills the address and the preselected model of Meta", () => {
    const { result } = choose();

    act(() => result.current.setProvider("meta"));

    expect(result.current.model).toBe("muse-spark-1.3");
    expect(result.current.typedBase).toBe("https://api.meta.ai/v1");
    expect(result.current.complete).toBe(true);
  });

  it("refuses an address that is not https, and is not complete with it", () => {
    const { result } = choose();
    act(() => result.current.setProvider("meta"));

    act(() => result.current.setBase("http://api.example.test/v1"));

    expect(result.current.baseRefused).toBe(true);
    expect(result.current.addressReady).toBe(false);
    expect(result.current.complete).toBe(false);
  });

  it("is not ready with an empty address, and trims a padded one", () => {
    const { result } = choose();
    act(() => result.current.setProvider("meta"));

    act(() => result.current.setBase("   "));
    expect(result.current.addressReady).toBe(false);

    act(() => result.current.setBase("  https://api.example.test/v1/  "));
    expect(result.current.addressReady).toBe(true);
    expect(result.current.choice.base).toBe("https://api.example.test/v1/");
    expect(result.current.target).toEqual({ provider: "meta", base: "https://api.example.test/v1" });
  });
});

describe("a provider with no model list of its own", () => {
  it("preselects Other and asks for a name before it is complete", () => {
    const { result } = choose();

    act(() => result.current.setProvider("custom"));
    act(() => result.current.setBase("https://llm.example.test/v1"));

    expect(result.current.model).toBe(otherModel);
    expect(result.current.usesOther).toBe(true);
    expect(result.current.showsName).toBe(true);
    expect(result.current.complete).toBe(false);

    act(() => result.current.setName("  my-model  "));

    expect(result.current.complete).toBe(true);
    expect(result.current.choice.name).toBe("my-model");
  });
});

describe("a provider that suggests a name from the model", () => {
  it("copies the chosen model into the name, and Other leaves the name to be typed", () => {
    const { result } = choose();
    act(() => result.current.setProvider("meta_open"));
    act(() => result.current.setBase("https://open.example.test/v1"));

    act(() => result.current.setModel("llama-4"));
    expect(result.current.typedName).toBe("llama-4");
    expect(result.current.showsName).toBe(true);

    act(() => result.current.setName("my own name"));
    act(() => result.current.setModel(otherModel));
    expect(result.current.typedName).toBe("my own name");
  });
});

describe("opening an account that already has a choice", () => {
  const start = { provider: "claude", model: "claude-sonnet-5-5" };

  it("starts complete and unchanged", () => {
    const { result } = choose(start);

    expect(result.current.complete).toBe(true);
    expect(result.current.changed).toBe(false);
  });

  it("is changed once another model is chosen", () => {
    const { result } = choose(start);

    act(() => result.current.setModel("claude-sonnet-5-6"));

    expect(result.current.changed).toBe(true);
  });

  it("settles on a model without counting it as a change from the one it opened with", () => {
    const { result } = choose(start);

    act(() => result.current.settle("claude-sonnet-5-5"));

    expect(result.current.model).toBe("claude-sonnet-5-5");
    expect(result.current.changed).toBe(false);
  });

  it("changing the provider clears the model and the choice is no longer complete", () => {
    const { result } = choose(start);

    act(() => result.current.setProvider("huggingface"));

    expect(result.current.model).toBe("");
    expect(result.current.complete).toBe(false);
    expect(result.current.changed).toBe(true);
  });
});
