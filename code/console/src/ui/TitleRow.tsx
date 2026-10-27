import { EnhanceButton } from "../shell/EnhanceButton";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { NoticeBar } from "./Notice";
import type { TitleRowProps } from "./props";

export function TitleRow({ title, primary, onPrimary, primaryTo, primaryIcon, primaryFlash, actions, children }: TitleRowProps) {
  const lead = !primary ? null : primaryTo ? (
    <ButtonLink to={primaryTo} icon={primaryIcon}>
      {primary}
    </ButtonLink>
  ) : (
    <Button icon={primaryIcon} onClick={onPrimary} className={primaryFlash ? "flash" : undefined}>
      {primary}
    </Button>
  );
  return (
    <>
      <div className="top">
        <h1>{title}</h1>
        <div className="top-end">
          {actions}
          <EnhanceButton />
          {lead}
          {children}
        </div>
      </div>
      <NoticeBar />
    </>
  );
}
