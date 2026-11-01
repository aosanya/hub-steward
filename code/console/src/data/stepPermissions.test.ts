import { permissionsOfStep } from "./stepPermissions";

describe("the permissions a step needs", () => {
  it.each([
    ["Post a price", "fill_form", ["market.offer"]],
    ["Offer the harvest", "fill_form", ["market.ask"]],
    ["Accept or decline the offer", "yes_no", ["market.ask_answer"]],
    ["Start the group order", "fill_form", ["market.group_order"]],
    ["Fill in the order", "fill_form", ["market.group_order_join"]],
    ["Send the order to the supplier", "notify", ["market.group_order_send"]],
    ["Confirm the order", "yes_no", ["market.group_order_promise"]],
  ])("reads %s from its words", (title, kind, expected) => {
    expect(permissionsOfStep(title, kind)).toEqual(expected);
  });

  it.each([
    ["Invite the farmers", "send_form", ["form.compose", "form.send"]],
    ["Say yes or no to the invitation", "yes_no", ["form.answer"]],
    ["Sort the answers by yes and no", "route", ["form.answers.read"]],
    ["Tell the buyer", "notify", ["chat.post", "chat.thread"]],
  ])("reads %s from its kind when no word names a market action", (title, kind, expected) => {
    expect(permissionsOfStep(title, kind)).toEqual(expected);
  });

  it("needs none for a kind it does not know", () => {
    expect(permissionsOfStep("Wait", "run_workflow")).toEqual([]);
  });
});
