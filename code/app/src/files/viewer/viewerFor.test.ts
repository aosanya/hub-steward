import { describe, expect, it } from "vitest";
import { viewerFor } from "./viewerFor";

describe("viewerFor", () => {
  it.each(["md", "markdown", "mdx"])("opens the %s extension as markdown", (extension) => {
    expect(viewerFor(`notes.${extension}`, extension)).toBe("markdown");
  });

  it.each(["go", "ts", "tsx", "js", "jsx", "json", "yaml", "yml", "toml", "sh", "py", "rb", "rs", "java", "kt", "swift", "dart", "kts", "plist", "storyboard", "xcscheme", "xcworkspacedata", "properties", "c", "h", "cpp", "css", "html", "sql", "mod", "sum"])(
    "opens the %s extension as code",
    (extension) => {
      expect(viewerFor(`file.${extension}`, extension)).toBe("code");
    },
  );

  it("opens Dockerfile and Makefile with no extension as code", () => {
    expect(viewerFor("Dockerfile", "")).toBe("code");
    expect(viewerFor("Makefile", "")).toBe("code");
  });

  it("matches the special code names without regard to case", () => {
    expect(viewerFor("dockerfile", "")).toBe("code");
    expect(viewerFor("MAKEFILE", "")).toBe("code");
  });

  it.each(["txt", "log", "csv"])("opens the %s extension as plain text", (extension) => {
    expect(viewerFor(`file.${extension}`, extension)).toBe("text");
  });

  it("opens an unknown extension as plain text", () => {
    expect(viewerFor("data.xyz", "xyz")).toBe("text");
  });

  it("opens a file with no extension and an ordinary name as plain text", () => {
    expect(viewerFor("LICENSE", "")).toBe("text");
  });

  it.each(["png", "jpg", "jpeg", "gif", "webp", "svg"])("opens the %s extension as an image", (extension) => {
    expect(viewerFor(`picture.${extension}`, extension)).toBe("image");
  });

  it("reads the extension without regard to case", () => {
    expect(viewerFor("README.MD", "MD")).toBe("markdown");
    expect(viewerFor("logo.PNG", "PNG")).toBe("image");
  });

  it("tolerates a leading dot in the extension", () => {
    expect(viewerFor("main.go", ".go")).toBe("code");
  });

  it("takes the extension from the name when it is omitted", () => {
    expect(viewerFor("main.go")).toBe("code");
    expect(viewerFor("guide.md")).toBe("markdown");
    expect(viewerFor("logo.png")).toBe("image");
  });

  it("takes only the last segment of the name as the extension", () => {
    expect(viewerFor("archive.tar.gz")).toBe("text");
  });

  it("recognises Dockerfile by name when the extension is omitted", () => {
    expect(viewerFor("Dockerfile")).toBe("code");
  });
});
