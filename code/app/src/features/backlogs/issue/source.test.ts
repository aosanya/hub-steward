import { describe, expect, it } from "vitest";
import { splitSource } from "./source";

describe("the source lines of a loaded description", () => {
  it("splits at the first line that starts with Read from", () => {
    expect(splitSource("Create the tables.\n\nRead from mwanachama-backend/todo.md\nAlso on the boards of: a, b")).toEqual({
      body: "Create the tables.",
      source: "Read from mwanachama-backend/todo.md\nAlso on the boards of: a, b",
    });
  });

  it("leaves a description with no source whole", () => {
    expect(splitSource("Only text")).toEqual({ body: "Only text", source: "" });
  });

  it("gives an empty body when the description is only the source", () => {
    expect(splitSource("Read from a/todo.md")).toEqual({ body: "", source: "Read from a/todo.md" });
  });
});
