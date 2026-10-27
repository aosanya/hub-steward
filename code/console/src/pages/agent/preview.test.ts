import { agencyPartsOf, assemblePreview } from "./preview";

const parts = [
  { source: "agency", text: "From the seat." },
  { source: "role", text: "From the role." },
];

describe("assemblePreview", () => {
  it("keeps the agency parts apart from the role's own words and the fine-tuning when the agency's instructions are used", () => {
    expect(assemblePreview(parts, true, "Reply in the customer's language.")).toEqual({
      agency: ["From the seat."],
      own: ["From the role.", "Reply in the customer's language."],
    });
  });

  it("leaves out the agency parts when the agency's instructions are switched off", () => {
    expect(assemblePreview(parts, false, "Reply in the customer's language.")).toEqual({
      agency: [],
      own: ["From the role.", "Reply in the customer's language."],
    });
  });

  it("shows the fine-tuning alone when there are no parts", () => {
    expect(assemblePreview([], true, "Only this.")).toEqual({ agency: [], own: ["Only this."] });
  });

  it("splits the fine-tuning into its lines and drops the empty ones", () => {
    expect(assemblePreview([], false, "First line.\n\nSecond line.\n").own).toEqual(["First line.", "Second line."]);
  });

  it("drops an empty fine-tuning and empty parts", () => {
    expect(assemblePreview([{ source: "role", text: "" }, ...parts], true, "")).toEqual({
      agency: ["From the seat."],
      own: ["From the role."],
    });
  });

  it("is empty when nothing is left", () => {
    expect(assemblePreview([{ source: "agency", text: "x" }], false, "")).toEqual({ agency: [], own: [] });
  });

  it("reads the four parts the agency sends for a seat as the agency's, and takes the saved fine-tuning part out in favour of what is typed", () => {
    const sent = [
      { source: "seat_description", text: "Dispatcher" },
      { source: "objectives", text: "O1" },
      { source: "values_rules", text: "V1" },
      { source: "work_item_instructions", text: "W1" },
      { source: "fine_tuning", text: "Saved words." },
    ];
    expect(assemblePreview(sent, true, "Typed words.")).toEqual({
      agency: ["Dispatcher", "O1", "V1", "W1"],
      own: ["Typed words."],
    });
    expect(assemblePreview(sent, false, "Typed words.")).toEqual({ agency: [], own: ["Typed words."] });
  });
});

describe("agencyPartsOf", () => {
  it("lists the parts that come from the agency and have words", () => {
    expect(agencyPartsOf([...parts, { source: "objectives", text: "" }, { source: "fine_tuning", text: "x" }])).toEqual([parts[0]]);
  });
});
