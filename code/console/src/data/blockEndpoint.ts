import type { Block } from "./scenario";

type Shape = Pick<Block, "kind" | "title" | "action">;

const byKind: Record<string, string> = {
  form: "forms_answer_submit",
  send_form: "forms_form_publish",
  yes_no: "forms_answer_submit",
  route: "forms_answer_list",
  notify: "comm_chat_message_post",
};

const marketRules: [string[], string][] = [
  [["start", "group", "order"], "market_start_group_order"],
  [["fill", "order"], "market_join_group_order"],
  [["join"], "market_join_group_order"],
  [["send", "order"], "market_send_group_order"],
  [["confirm", "order"], "market_promise_group_order"],
  [["promise"], "market_promise_group_order"],
];

const marketEndpoint = (block: Shape): string => {
  const text = `${block.title} ${block.action}`.toLowerCase();
  return marketRules.find(([words]) => words.every((word) => text.includes(word)))?.[1] ?? "";
};

export const suggestedEndpoint = (block: Shape): string =>
  marketEndpoint(block) || (byKind[block.kind] ?? "");
