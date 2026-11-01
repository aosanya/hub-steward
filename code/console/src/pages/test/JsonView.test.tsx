import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonView } from "./JsonView";

const view = (text: string) => render(<JsonView text={text} />).container;

describe("showing a JSON line", () => {
  it("colours keys, strings, numbers and words separately", () => {
    const box = view('{"name":"Amina","age":-4.5,"ok":true,"gone":null,"no":false}');
    expect([...box.querySelectorAll(".json-key")].map((n) => n.textContent)).toEqual(['"name"', '"age"', '"ok"', '"gone"', '"no"']);
    expect([...box.querySelectorAll(".json-string")].map((n) => n.textContent)).toEqual(['"Amina"']);
    expect([...box.querySelectorAll(".json-number")].map((n) => n.textContent)).toEqual(["-4.5"]);
    expect([...box.querySelectorAll(".json-word")].map((n) => n.textContent)).toEqual(["true", "null", "false"]);
  });

  it("keeps the exact words, indented", () => {
    expect(view('{"a":[1,2]}').querySelector("pre")?.textContent).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
  });

  it("does not colour true, a number or a colon inside a string", () => {
    const box = view('{"k":"true 12 : x"}');
    expect(box.querySelectorAll(".json-word")).toHaveLength(0);
    expect(box.querySelectorAll(".json-number")).toHaveLength(0);
    expect([...box.querySelectorAll(".json-string")].map((n) => n.textContent)).toEqual(['"true 12 : x"']);
  });

  it("handles escaped quotes in a string", () => {
    const box = view('{"k":"say \\"hi\\""}');
    expect([...box.querySelectorAll(".json-string")].map((n) => n.textContent)).toEqual(['"say \\"hi\\""']);
  });

  it.each([["plain words"], ["42"], ['"quoted"'], ["true"], ["null"], ["{broken"], [""]])("shows %j as it came, with no block", (text) => {
    const box = view(text);
    expect(box.querySelector("pre")).toBeNull();
    expect(box.textContent).toBe(text);
  });

  it("shows an empty object and list as blocks", () => {
    expect(view("{}").querySelector("pre")?.textContent).toBe("{}");
    expect(view("[]").querySelector("pre")?.textContent).toBe("[]");
  });
});
