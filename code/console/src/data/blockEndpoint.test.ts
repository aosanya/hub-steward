import { suggestedEndpoint } from "./blockEndpoint";

const block = (kind: string, title = "", action = "") => ({ kind, title, action });

describe("the endpoint suggested for a block", () => {
  it("follows the step kind for forms and comm", () => {
    expect(suggestedEndpoint(block("form"))).toBe("forms_answer_submit");
    expect(suggestedEndpoint(block("yes_no"))).toBe("forms_answer_submit");
    expect(suggestedEndpoint(block("send_form"))).toBe("forms_form_publish");
    expect(suggestedEndpoint(block("route"))).toBe("forms_answer_list");
    expect(suggestedEndpoint(block("notify"))).toBe("comm_chat_message_post");
  });

  it("names the market endpoint of the four group order steps", () => {
    expect(suggestedEndpoint(block("form", "Start the group order"))).toBe("market_start_group_order");
    expect(suggestedEndpoint(block("form", "Fill in the order"))).toBe("market_join_group_order");
    expect(suggestedEndpoint(block("notify", "Send the order to the supplier"))).toBe("market_send_group_order");
    expect(suggestedEndpoint(block("yes_no", "Confirm the order"))).toBe("market_promise_group_order");
  });

  it("suggests nothing for an unknown kind", () => {
    expect(suggestedEndpoint(block("other"))).toBe("");
  });
});
