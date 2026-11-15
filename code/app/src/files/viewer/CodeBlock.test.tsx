import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "./CodeBlock";
import { highlight } from "./highlight";

const numbersOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".code-line .code-no")).map((node) => node.textContent);

describe("code block", () => {
  it("numbers go lines from 1, marks package as a keyword and a string token, and drops the trailing newline", () => {
    const source = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi")\n}\n';
    const { container } = render(<CodeBlock source={source} language="go" />);
    expect(numbersOf(container)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    const keywords = Array.from(container.querySelectorAll(".tok-keyword")).map((node) => node.textContent);
    expect(keywords).toContain("package");
    expect(keywords).toContain("func");
    expect(container.querySelector(".tok-string")?.textContent).toBe('"fmt"');
    expect(container.querySelectorAll(".code-line")[1].textContent).toBe("2");
  });

  it("keeps a 500 character line in the scroll block with its number apart", () => {
    const long = "x".repeat(500);
    const { container } = render(<CodeBlock source={`var a = "${long}"`} language="go" />);
    const line = container.querySelector(".code-scroll .code-line");
    expect(line?.querySelector(".code-no")?.textContent).toBe("1");
    expect(line?.textContent).toContain(long);
    expect(line?.querySelector(".code-no")?.textContent).not.toContain("x");
  });

  it("marks json keys, strings, numbers and literals", () => {
    const { container } = render(<CodeBlock source={'{\n  "name": "viewer",\n  "count": 3,\n  "ok": true\n}\n'} language="json" />);
    expect(numbersOf(container)).toEqual(["1", "2", "3", "4", "5"]);
    expect(Array.from(container.querySelectorAll(".tok-function")).map((node) => node.textContent)).toEqual(['"name"', '"count"', '"ok"']);
    expect(Array.from(container.querySelectorAll(".tok-string")).map((node) => node.textContent)).toEqual(['"viewer"']);
    expect(container.querySelector(".tok-number")?.textContent).toBe("3");
    expect(container.querySelector(".tok-keyword")?.textContent).toBe("true");
  });

  it("carries a block comment across lines", () => {
    const { container } = render(<CodeBlock source={"a /* one\ntwo\nthree */ b"} language="go" />);
    const comments = Array.from(container.querySelectorAll(".tok-comment")).map((node) => node.textContent);
    expect(comments).toEqual(["/* one", "two", "three */"]);
    expect(container.querySelectorAll(".code-line")[2].textContent).toBe("3three */ b");
  });

  it("splits on CRLF and keeps empty lines numbered", () => {
    const { container } = render(<CodeBlock source={"one\r\n\r\nthree\r\n"} language="plain" />);
    expect(numbersOf(container)).toEqual(["1", "2", "3"]);
    expect(container.querySelector(".tok")).toBeNull();
  });

  it("carries go raw strings and python triple quotes across lines", () => {
    const go = highlight("x := `a\nb`\ny := 1", "go");
    expect(go[1][0]).toEqual({ kind: "string", text: "b`" });
    expect(go[2][go[2].length - 1]).toEqual({ kind: "number", text: "1" });
    const py = highlight('"""doc\nmore"""\nx = 2  # tail', "python");
    expect(py[1][0]).toEqual({ kind: "string", text: 'more"""' });
    expect(py[2].map((token) => token.kind)).toEqual(["plain", "number", "plain", "comment"]);
  });

  it("handles escapes, sql case and line comments", () => {
    const go = highlight('s := "a\\"b" // end', "go");
    expect(go[0].filter((token) => token.kind === "string")).toEqual([{ kind: "string", text: '"a\\"b"' }]);
    expect(go[0][go[0].length - 1].kind).toBe("comment");
    const sql = highlight("SELECT 1 -- note", "sql");
    expect(sql[0].map((token) => token.kind)).toEqual(["keyword", "plain", "number", "plain", "comment"]);
  });

  it("highlights dart keywords, built-ins, strings, numbers and comments", () => {
    const dart = highlight("class MyApp extends StatelessWidget { // root\n  final int count = 3;\n  void run() => print('a');\n}", "dart");
    expect(dart[0].filter((token) => token.kind === "keyword").map((token) => token.text)).toEqual(["class", "extends"]);
    expect(dart[0][dart[0].length - 1]).toEqual({ kind: "comment", text: "// root" });
    expect(dart[1].filter((token) => token.kind !== "plain")).toEqual([
      { kind: "keyword", text: "final" },
      { kind: "keyword", text: "int" },
      { kind: "number", text: "3" },
    ]);
    expect(dart[2].filter((token) => token.kind === "string")).toEqual([{ kind: "string", text: "'a'" }]);
  });

  it("leaves unknown languages plain and stays fast on a long line", () => {
    expect(highlight("func x()", "plain")).toEqual([[{ kind: "plain", text: "func x()" }]]);
    const started = Date.now();
    highlight(`"${"\\".repeat(500)}${"a/*".repeat(200)}`, "go");
    expect(Date.now() - started).toBeLessThan(200);
  });
});
