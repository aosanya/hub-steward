export type FileViewerProps = {
  name: string;
  extension: string;
  text: string | null;
  size: number;
  bytes?: Uint8Array | null;
  reason?: string;
};

export function FileViewer(_props: FileViewerProps): JSX.Element {
  return <div className="file-viewer" />;
}
