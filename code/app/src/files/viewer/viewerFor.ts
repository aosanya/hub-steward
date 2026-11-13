export type ViewerKind = "markdown" | "code" | "text" | "image" | "none";

export function viewerFor(_name: string, _extension?: string): ViewerKind {
  return "none";
}
