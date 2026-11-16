import { askedCountFirst, type ResultDraft } from "./results";

const issue = (id: string) => ({ id, title: id }) as ResultDraft["issues"][number];

const list = (title: string, total: number, rows: number): ResultDraft => ({ title, total, issues: Array.from({ length: rows }, (_, at) => issue(`${title}-${at}`)) });

describe("the list an answer puts first when the words ask for a count", () => {
  const pending = list("Pending mwanachama-frontend-kazi issues", 724, 25);
  const asked = list("Mwanachama-frontend-kazi issues", 300, 25);

  it("is the list whose total is the number asked for, even when it was read second", () => {
    expect(askedCountFirst([pending, asked], "the 300 issues tagged mwanachama-frontend-kazi")).toEqual([asked, pending]);
  });

  it("keeps the order read when the words ask for no count", () => {
    expect(askedCountFirst([pending, asked], "show all issues tagged mwanachama-frontend-kazi")).toEqual([pending, asked]);
  });

  it("keeps the order read when no list holds that many", () => {
    expect(askedCountFirst([pending, asked], "the 12 issues tagged mwanachama-frontend-kazi")).toEqual([pending, asked]);
  });

  it("ignores a list with no rows", () => {
    const empty = list("Empty", 300, 0);
    expect(askedCountFirst([pending, empty], "the 300 issues")).toEqual([pending, empty]);
  });
});
