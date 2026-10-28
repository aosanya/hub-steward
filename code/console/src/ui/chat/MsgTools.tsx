import { useState } from "react";
import { useI18n } from "../../i18n";
import { Icon } from "../Icon";
import type { MsgToolsProps, ToolCall } from "../props";
import { formatMs } from "./format";

export function MsgTool({ name, summary, state = "done", ms }: ToolCall) {
  const mark =
    state === "running" ? (
      <span className="tool-spin" />
    ) : (
      <Icon name={state === "error" ? "cross" : "check"} size={14} stroke={2.6} />
    );
  return (
    <div className={state === "error" ? "tool error" : "tool"}>
      <span className="tool-ico">
        <Icon name="plug" size={14} />
      </span>
      <span className="tool-name">{name}</span>
      <span className="tool-state">{mark}</span>
      <span className="tool-ms">{formatMs(ms)}</span>
      <span className="tool-sum">{summary}</span>
    </div>
  );
}

export function MsgTools({ calls, title, expanded = false }: MsgToolsProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(expanded);
  const total = calls.reduce((sum, call) => sum + (call.ms ?? 0), 0);
  const heading = title ?? t(calls.length === 1 ? "ui.toolCalledOne" : "ui.toolsCalled").replace("{n}", String(calls.length));
  return (
    <div className={open ? "tools" : "tools collapsed"}>
      <button type="button" className="tools-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="chevron-down" size={14} />
        <span>{heading}</span>
        {total > 0 ? <span className="muted">{formatMs(total)}</span> : null}
      </button>
      {open ? calls.map((call, i) => <MsgTool key={i} {...call} />) : null}
    </div>
  );
}
