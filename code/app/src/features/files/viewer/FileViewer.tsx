import { CodeBlock } from "./CodeBlock";
import { formatSize } from "./formatSize";
import { MarkdownPage } from "./MarkdownPage";
import { languageFor, viewerFor } from "./viewerFor";
import "./viewer.css";

export type FileViewerProps = {
  name: string;
  extension: string;
  text: string | null;
  size: number;
  bytes?: Uint8Array | null;
  reason?: string;
};

const imageTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const chunkSize = 0x8000;

function base64Of(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return btoa(binary);
}

function imageSource(extension: string, bytes: Uint8Array): string {
  const type = imageTypes[extension.replace(/^\./, "").toLowerCase()] ?? "application/octet-stream";
  return `data:${type};base64,${base64Of(bytes)}`;
}

function reasonSentence(reason: string | undefined): string {
  return reason === "too large" ? "This file is too large to show." : "This file is not text, so it is not shown.";
}

function Withheld({ name, size, sentence }: { name: string; size: number; sentence: string }) {
  return (
    <div className="withheld">
      <p className="withheld-name">{name}</p>
      <p className="withheld-size">{formatSize(size)}</p>
      <p className="withheld-reason">{sentence}</p>
    </div>
  );
}

function body({ name, extension, text, size, bytes, reason }: FileViewerProps): JSX.Element {
  const kind = viewerFor(name, extension);
  if (text !== null) {
    if (kind === "markdown") return <MarkdownPage source={text} />;
    if (kind === "code") return <CodeBlock source={text} language={languageFor(name, extension)} />;
    return <pre className="text-view">{text}</pre>;
  }
  if (kind === "image") {
    if (bytes && bytes.length > 0) {
      return (
        <figure className="image-view">
          <img alt={name} src={imageSource(extension, bytes)} />
          <figcaption>{name}</figcaption>
        </figure>
      );
    }
    return <Withheld name={name} size={size} sentence="This image could not be shown." />;
  }
  return <Withheld name={name} size={size} sentence={reasonSentence(reason)} />;
}

export function FileViewer(props: FileViewerProps): JSX.Element {
  return <div className="file-viewer">{body(props)}</div>;
}
