type Rule = { words: string[]; permissions: string[] };

const marketRules: Rule[] = [
  { words: ["post", "price"], permissions: ["market.offer"] },
  { words: ["sell", "now"], permissions: ["market.ask"] },
  { words: ["offer", "harvest"], permissions: ["market.ask"] },
  { words: ["accept"], permissions: ["market.ask_answer"] },
  { words: ["answer", "ask"], permissions: ["market.ask_answer"] },
  { words: ["start", "group", "order"], permissions: ["market.group_order"] },
  { words: ["fill", "order"], permissions: ["market.group_order_join"] },
  { words: ["join"], permissions: ["market.group_order_join"] },
  { words: ["send", "order"], permissions: ["market.group_order_send"] },
  { words: ["confirm", "order"], permissions: ["market.group_order_promise"] },
  { words: ["promise"], permissions: ["market.group_order_promise"] },
];

const kindPermissions: Record<string, string[]> = {
  fill_form: ["form.answer"],
  yes_no: ["form.answer"],
  send_form: ["form.compose", "form.send"],
  route: ["form.answers.read"],
  notify: ["chat.post", "chat.thread"],
};

export const permissionsOfStep = (title: string, kind: string, description = ""): string[] => {
  const text = (title + " " + description).toLowerCase();
  const rule = marketRules.find((candidate) => candidate.words.every((word) => text.includes(word)));
  return rule ? rule.permissions : (kindPermissions[kind] ?? []);
};
