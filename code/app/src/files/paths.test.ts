import { beforeEach, describe, expect, it } from "vitest";
import { openAgency } from "../agency/open";
import { filePath, filesHomePath, folderPath, pathParam } from "./paths";

beforeEach(() => openAgency("hub-1"));

describe("the paths of the Files screens", () => {
  it("puts the Folders list at files under the open agency", () => {
    expect(filesHomePath()).toBe("/a/hub-1/files");
  });

  it("puts a Folder's top level at its id, and a folder inside it in the path parameter", () => {
    expect(pathParam).toBe("path");
    expect(folderPath("r1")).toBe("/a/hub-1/files/r1");
    expect(folderPath("r1", "")).toBe("/a/hub-1/files/r1");
    expect(folderPath("r1", "docs")).toBe("/a/hub-1/files/r1?path=docs");
    expect(folderPath("r1", "docs/notes")).toBe("/a/hub-1/files/r1?path=docs%2Fnotes");
  });

  it("puts a file at file under its Folder, with its path in the path parameter", () => {
    expect(filePath("r1", "main.go")).toBe("/a/hub-1/files/r1/file?path=main.go");
    expect(filePath("r1", "docs/a.md")).toBe("/a/hub-1/files/r1/file?path=docs%2Fa.md");
  });
});
