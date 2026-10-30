import { ask, pick, type Plan } from "./seed";

const FARMER = "Farmer";
const BUYER = "Buyer";
const FARMERS_AGENT = "Farmers' agent";
const COORDINATOR = "Group coordinator";
const SUPPLIER = "Supplier";
const SUPPLIERS_AGENT = "Suppliers' agent";

export const sellHarvest: Plan = {
  goal: "Farmers sell their harvest",
  objective: "Farmers see what each buyer pays and sell to one",
  rationale: "a sale is a market ask the buyer answers",
  roles: {
    [FARMER]: ["market.browse", "market.ask"],
    [BUYER]: ["market.browse", "market.poster", "market.offer", "market.ask"],
    [FARMERS_AGENT]: ["ai.use"],
  },
  workflow: { name: "Sell harvest", description: "A farmer sells a harvest to a buyer" },
  steps: [
    {
      title: "Post a price",
      kind: "fill_form",
      role: BUYER,
      form: "Post a price form",
      questions: [
        ask("Enter the product", "free_text"),
        ask("Enter the unit", "free_text"),
        ask("Enter the price per bag", "currency"),
        ask("Enter the bulk price per bag", "currency"),
        ask("Enter the bags the bulk price starts from", "number"),
      ],
    },
    { title: "Sell now", kind: "fill_form", role: FARMER, form: "Sell now form", questions: [ask("Enter the number of bags", "number")] },
    { title: "Ask the buyer", kind: "notify", role: FARMERS_AGENT, form: "Ask", questions: [ask("Write the message", "free_text")] },
    {
      title: "Answered",
      kind: "yes_no",
      role: BUYER,
      form: "The buyer's answer",
      questions: [ask("Can you take these bags?", "yes_no"), ask("Enter the date to collect", "date"), ask("Add a note", "free_text")],
    },
  ],
  rules: [
    "The agents ask only the buyer a farmer picked, once, and they never say yes for a person.",
    "Nothing runs on a timer: when a buyer does not answer, the agents do nothing and the farmer waiting decides.",
    "A sale keeps the price it was made at, and its total is the bags times that price.",
  ],
  rulesOnTheWorkflow: [0, 1, 2],
  scenario: {
    name: "Sell harvest: a farmer sells 40 bags of maize now and the buyer says yes",
    summary: "The buyer posts a price, the farmer sells now, the Farmers' agent asks the buyer once, and the buyer says yes",
    actors: [
      { name: "Asha Otieno", role: FARMER },
      { name: "Kisumu Grain Traders", role: BUYER },
    ],
    thens: {
      "Post a price": "Kisumu Grain Traders' price for dry maize: KES 4,200 a bag, and KES 4,350 a bag from 100 bags",
      "Sell now": "Asha Otieno's sale of 40 bags of maize at KES 4,200 a bag, KES 168,000 in all",
      "Ask the buyer": "One ask to Kisumu Grain Traders for 40 bags, with no answer yet",
      Answered: "Kisumu Grain Traders' yes: 40 bags from Asha Otieno at KES 4,200 a bag, KES 168,000 in all, to collect on Friday, 6 Nov",
    },
    inputs: [
      { step: "Post a price", field: "Enter the product", value: "dry maize" },
      { step: "Post a price", field: "Enter the unit", value: "90 kg bag" },
      { step: "Post a price", field: "Enter the price per bag", value: "4200" },
      { step: "Post a price", field: "Enter the bulk price per bag", value: "4350" },
      { step: "Post a price", field: "Enter the bags the bulk price starts from", value: "100" },
      { step: "Sell now", field: "Enter the number of bags", value: "40" },
      { step: "Answered", field: "Can you take these bags?", value: "Yes" },
      { step: "Answered", field: "Enter the date to collect", value: "2026-11-06" },
      { step: "Answered", field: "Add a note", value: "Collect from the farm on Friday" },
    ],
  },
};

const joinQuestion = "Do you want to join this order?";

export const groupOrder: Plan = {
  goal: "Farmers buy together",
  objective: "Farmers buy together in a group order",
  rationale: "the group order is a market order",
  roles: {
    [COORDINATOR]: ["market.browse", "market.group_order"],
    [FARMER]: ["market.browse"],
    [SUPPLIER]: ["market.browse", "market.poster"],
    [FARMERS_AGENT]: ["ai.use"],
    [SUPPLIERS_AGENT]: ["ai.use"],
  },
  workflow: { name: "Group order", description: "Farmers buy together in a group order" },
  steps: [
    {
      title: "Start",
      kind: "fill_form",
      role: COORDINATOR,
      form: "Group order form",
      questions: [
        pick("Select the target group", "Siaya farmers"),
        pick("Select the supplier", SUPPLIER),
        ask("Enter the bulk price per bag", "currency"),
        ask("Enter the minimum total of bags", "number"),
      ],
    },
    { title: "Send the invitation", kind: "send_form", role: "", form: "Invitation", questions: [ask(joinQuestion, "yes_no")], recipient: FARMER },
    { title: "Answer the invitation", kind: "yes_no", role: FARMER, form: "", questions: [], sentStep: "Send the invitation" },
    { title: "Sort the answers", kind: "route", role: "", form: "", questions: [], sentStep: "Send the invitation" },
    { title: "Open", kind: "fill_form", role: FARMER, form: "Join form", questions: [ask("Enter the number of bags", "number")] },
    { title: "Send", kind: "notify", role: COORDINATOR, form: "Order", questions: [ask("Write the message", "free_text")] },
    {
      title: "Answered",
      kind: "yes_no",
      role: SUPPLIER,
      form: "The supplier's answer",
      questions: [ask("Can you fill this order?", "yes_no"), ask("Enter the date you can deliver", "date")],
    },
    {
      title: "Thank you",
      kind: "notify",
      role: "",
      form: "Thank-you message",
      questions: [{ prompt: "Message sent", answer_type: "free_text", required: true, fixed: "Thank you for the response" }],
    },
  ],
  route: { step: "Sort the answers", sent: "Send the invitation", question: joinQuestion, value: "yes", goTo: "Open", otherwise: "Thank you" },
  rules: [
    "A supplier or buyer appears in the market only after the group coordinator has approved them.",
    "A group order starts from a posted bulk price, and the group coordinator sets its minimum before it starts.",
    "An order keeps the price and terms it started with, and new terms count only for a farmer who says yes to them.",
    "A farmer is in a group order only after they have said yes to its terms.",
    "The group coordinator decides each farmer who stays silent, and the order waits for that decision.",
    "A farmer can cancel an order at once, and the supplier or buyer is told, unless the agency has a cancel workflow.",
    "The agents ask only the supplier or buyer a person picked or ticked, once each, and they never say yes for a person.",
    "Nothing runs on a timer: when a person does not answer, the agents do nothing and the person waiting decides.",
  ],
  rulesOnTheWorkflow: [1, 3, 6],
  scenario: {
    name: "Group order: farmers join and the coordinator sends",
    summary: "Start, the invitation, Open, Send and Answered, in order, then each payment in Payments",
    actors: [
      { name: COORDINATOR, role: COORDINATOR },
      { name: "Farmer 1", role: FARMER },
      { name: "Farmer 2", role: FARMER },
      { name: SUPPLIER, role: SUPPLIER },
    ],
    thens: {
      Start: "The group order with the terms it started with, KES 3,600 a bag from 20 bags, and the minimum, 20 bags. It keeps the draft's Group order workflow.",
      "Send the invitation": "An invitation to every member of the group, with a yes or no to answer",
      "Answer the invitation": "Farmer 1's answer to the invitation: yes",
      "Sort the answers": "Each yes goes on; anything else would be thanked at once",
      Open: "A line for Farmer 1: 20 bags, joined. The total is 20 of 20 bags",
      Send: "Send is open because the total has reached the minimum",
      Answered: "The Supplier's yes: 20 bags of urea for Farmer 1, Friday, 6 Nov",
    },
    inputs: [
      { step: "Start", field: "Enter the bulk price per bag", value: "3600" },
      { step: "Start", field: "Enter the minimum total of bags", value: "20" },
      { step: "Open", field: "Enter the number of bags", value: "20" },
      { step: "Answered", field: "Can you fill this order?", value: "Yes" },
      { step: "Answered", field: "Enter the date you can deliver", value: "2026-11-06" },
    ],
  },
};
