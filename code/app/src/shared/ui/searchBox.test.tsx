import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SearchBox } from "./SearchBox";

afterEach(cleanup);

const searchBoxCss = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "searchSelect.css"), "utf8");

describe("the Search field shows one clear button once a word is typed", () => {
  it("renders its own single clear button when a word is typed and none when empty", () => {
    const { rerender } = render(<SearchBox label="Search" value="" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    rerender(<SearchBox label="Search" value="Street light" onChange={() => {}} />);
    expect(screen.getAllByRole("button", { name: "Clear search" })).toHaveLength(1);
  });

  it("hides the browser's own cross on the search input, so only that one button shows", () => {
    expect(searchBoxCss).toMatch(/\.search-box input\[type="search"\]::-webkit-search-cancel-button\s*\{[^}]*appearance:\s*none/);
  });
});
