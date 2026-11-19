import { dayWithYearWords } from "./days";

describe("dayWithYearWords", () => {
  it("reads a day with its weekday, month and year", () => {
    expect(dayWithYearWords("1984-03-09")).toBe("Friday, 9 Mar 1984");
  });

  it("keeps the year of a day in the current year", () => {
    const year = new Date().getUTCFullYear();
    expect(dayWithYearWords(`${year}-01-02`).endsWith(String(year))).toBe(true);
  });

  it("gives back what it cannot read", () => {
    expect(dayWithYearWords("")).toBe("");
    expect(dayWithYearWords("soon")).toBe("soon");
  });
});
