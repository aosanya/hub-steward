import { Icon } from "./Icon";
import type { TimelineProps } from "./props";

export function Timeline({ items }: TimelineProps) {
  return (
    <ol className="timeline">
      {items.map((item, i) => (
        <li key={i} className={`tl-item ${item.state}`} aria-current={item.state === "now" ? "step" : undefined}>
          <span className="tl-dot">{item.state === "done" ? <Icon name="check" size={12} stroke={3.2} /> : null}</span>
          <span className="tl-text">
            <span className="tl-title">{item.title}</span>
            <span className="tl-meta">{item.meta}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
