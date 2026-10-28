import { Icon } from "../Icon";
import type { MsgUserProps } from "../props";

export function MsgUser({ children }: MsgUserProps) {
  return (
    <div className="msg user">
      <div className="bubble">{children}</div>
    </div>
  );
}

export function MsgAssistant({ children }: MsgUserProps) {
  return (
    <div className="msg bot">
      <span className="bot-badge">
        <Icon name="robot" size={14} />
      </span>
      <div className="bot-text">{children}</div>
    </div>
  );
}
