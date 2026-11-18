import { clearCarriedChatAbout, useCarriedChatAbout } from "../../app/chatAbout";
import { Chip } from "../../shared/ui/Chip";
import { aboutLabel } from "./aboutSubjects";

export function AboutLine() {
  const about = useCarriedChatAbout();
  if (!about) return null;
  return (
    <p className="assistant-about">
      <Chip>About {aboutLabel(about)}</Chip>
      <button type="button" className="assistant-unqueue" aria-label={`Clear About ${aboutLabel(about)}`} onClick={clearCarriedChatAbout}>
        ×
      </button>
    </p>
  );
}
