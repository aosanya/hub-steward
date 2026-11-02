import type { ActionTool } from "./chatActions";
import { roleLimitAction, roleLimitAnswer, roleLimitParamsOf, roleLimitSpec, roleLimitView, showRoleLimitFormTool } from "./roleLimitAction";
import { roleLimitKeys } from "./roleLimits";

const fitsThePageActions: ActionTool = roleLimitAction;

describe("asking the chat to change one limit of an AI role", () => {
  it("offers the model one tool that names the limit by the key the role saves it under", () => {
    expect(fitsThePageActions.spec).toBe(roleLimitSpec);
    expect(roleLimitSpec.name).toBe(showRoleLimitFormTool);
    const properties = roleLimitSpec.parameters.properties as Record<string, { enum?: string[] }>;
    expect(properties.limit.enum).toEqual([...roleLimitKeys]);
    expect(roleLimitSpec.parameters.required).toEqual(["limit"]);
  });

  it("lands the answer in the content area as the role-limit view with what the model gave", () => {
    const args = { role: "r1", limit: "tokens_per_day", value: 150000 };
    expect(roleLimitAction.answer("Raise the daily tokens", args)).toEqual({
      kind: "action",
      prompt: "Raise the daily tokens",
      view: roleLimitView,
      title: "",
      params: args,
    });
    expect(roleLimitAnswer("x", args).params).not.toBe(args);
  });

  it("reads the agent, the limit and the value out of the params", () => {
    expect(roleLimitParamsOf({ role: "r1", limit: "tokens_per_day", value: 150000 })).toEqual({ role: "r1", limit: "tokens_per_day", value: 150000 });
  });

  it("leaves the agent and the value open when the model gave none", () => {
    expect(roleLimitParamsOf({ limit: "requests_per_minute" })).toEqual({ role: "", limit: "requests_per_minute", value: null });
  });

  it("leaves out a value that is negative, fractional or not a number", () => {
    for (const value of [-1, 1.5, "100"]) expect(roleLimitParamsOf({ limit: "tokens_per_day", value })?.value).toBeNull();
  });

  it("is nothing for a limit it does not know", () => {
    expect(roleLimitParamsOf({ role: "r1", limit: "tokens_per_hour" })).toBeNull();
    expect(roleLimitParamsOf({})).toBeNull();
  });
});
