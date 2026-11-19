import { filled, shown, toAnswer } from "./answers";
import type { FormQuestion } from "./api";

const hours: FormQuestion = { id: "q1", prompt: "Between which hours?", answer_type: "time_range", required: true, options: [] };

const draftOf = (text: string) => ({ q1: { text, options: [] as string[] } });

describe("a time range answer", () => {
  it("is filled only when both times are given", () => {
    expect(filled(hours, draftOf(""))).toBe(false);
    expect(filled(hours, draftOf("09:00-"))).toBe(false);
    expect(filled(hours, draftOf("-22:00"))).toBe(false);
    expect(filled(hours, draftOf("09:00-22:00"))).toBe(true);
  });

  it("is sent as a from time and a to time", () => {
    expect(toAnswer(hours, draftOf("09:00-22:00"))).toEqual({ question_id: "q1", value_time: "09:00", value_time_to: "22:00" });
  });

  it("is read back as from and to", () => {
    expect(shown(hours, draftOf("09:00-22:00"))).toBe("from 09:00 to 22:00");
  });
});
