import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { forgetOpenAgency, openAgency } from "../../../shared/wakala/openAgency";
import { bookPath, bookRoutePath } from "./paths";

beforeEach(() => openAgency("hub-1"));

afterEach(() => forgetOpenAgency());

describe("the paths of the Book", () => {
  it("declares the route pattern as one static word", () => {
    expect(bookRoutePath).toBe("book");
  });

  it("builds the address on the agency base", () => {
    expect(bookPath()).toBe("/a/hub-1/backlogs/book");
  });
});
