import { describe, expect, it } from "vitest";
import type { FolderEntry } from "./api";
import { foldersFirst } from "./folderOrder";

const entry = (name: string, folder: boolean): FolderEntry => ({ name, path: name, folder, size: 0 });

describe("the order of a folder's entries", () => {
  it("lists folders before files, each group sorted by name with numbers in numeric order", () => {
    const listed = [entry("README.md", false), entry("2. design", true), entry("agency", true), entry(".gitignore", false), entry("10. later", true), entry("1. requirements", true)];
    expect(foldersFirst(listed).map((one) => one.name)).toEqual(["1. requirements", "2. design", "10. later", "agency", ".gitignore", "README.md"]);
  });

  it("leaves the listing it was given untouched", () => {
    const listed = [entry("b", true), entry("a", true)];
    foldersFirst(listed);
    expect(listed.map((one) => one.name)).toEqual(["b", "a"]);
  });
});
