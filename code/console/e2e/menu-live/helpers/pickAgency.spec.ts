import { expect, test } from "@playwright/test";
import { pickAgency } from "./pickAgency";

const held = [
  { id: "a-1", name: "Zöldhalom" },
  { id: "a-2", name: "05-mounts" },
];

test("no name picks the first agency", () => {
  expect(pickAgency(held)).toEqual(held[0]);
});

test("a name picks the agency with that name", () => {
  expect(pickAgency(held, "05-mounts")).toEqual(held[1]);
});

test("a name that is not held throws and lists the names held", () => {
  expect(() => pickAgency(held, "06-nothing")).toThrow(/06-nothing.*Zöldhalom.*05-mounts/);
});

test("a person with no agency throws", () => {
  expect(() => pickAgency([])).toThrow(/no agency/);
});
