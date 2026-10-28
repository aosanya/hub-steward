import type { ToolbarProps } from "./props";

export function Toolbar({ left, right }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">{left}</div>
      {right ? <div className="toolbar-group">{right}</div> : null}
    </div>
  );
}
