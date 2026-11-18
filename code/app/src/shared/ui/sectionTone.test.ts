import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/shared/ui/section.css"), "utf8");

describe("section.css footer act tone", () => {
  it("has one danger rule for a footer act that uses the existing danger token and no pixel font size", () => {
    const rule = /\.sec-act\.danger\s*\{([^}]*)\}/.exec(css);

    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain("var(--danger)");
    expect(css).not.toMatch(/font-size:\s*[\d.]+px/);
    expect(css.match(/\.sec-act\.danger/g)).toHaveLength(1);
  });
});
