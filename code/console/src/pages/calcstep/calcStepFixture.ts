import type { FunctionChoice, FunctionVersions, StepHeader } from "./calcStepApi";

export const fixtureFunctions: FunctionVersions[] = [
  {
    name: "fin.pmt",
    versions: [1, 2, 3],
    about: "Works out the repayment of a loan over a number of months. Called by name and version.",
  },
  {
    name: "fin.rate",
    versions: [1],
    about: "Works out the rate a member is charged from the size of the balance.",
  },
  {
    name: "date.late_days",
    versions: [1],
    about: "Counts the days between a due date and the day a filing was made.",
  },
];

export const fixtureChoice: FunctionChoice = { name: "fin.pmt", version: 2 };

export const fixtureHeader: StepHeader = {
  id: "s1",
  code: "WI-7",
  title: "Work out the monthly payment",
};
