import { Button } from "../Button";
import { ButtonLink } from "../ButtonLink";
import type { MsgButtonData } from "../props";

export function MsgButton({ label, kind = "quiet", to, onClick, disabled }: MsgButtonData) {
  if (to)
    return (
      <ButtonLink to={to} kind={kind} size="sm" icon="arrow" onClick={onClick}>
        {label}
      </ButtonLink>
    );
  return (
    <Button kind={kind} size="sm" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}

export function msgButtonItems(buttons: MsgButtonData[]) {
  return buttons.length === 0 ? undefined : buttons.map((button, i) => <MsgButton key={i} {...button} />);
}

export function MsgButtons({ buttons }: { buttons: MsgButtonData[] }) {
  if (buttons.length === 0) return null;
  return (
    <div className="msg-buttons">
      {buttons.map((button, i) => (
        <MsgButton key={i} {...button} />
      ))}
    </div>
  );
}
