import { clearCarriedChatAbout, useCarriedChatAbout } from "../../app/chatAbout";
import { Chip } from "../../shared/ui/Chip";

export function AboutLine() {
  const about = useCarriedChatAbout();
  if (!about) return null;
  return (
    <p className="assistant-about">
      <Chip>About {about.name}</Chip>
      <button type="button" className="assistant-unqueue" aria-label={`Clear About ${about.name}`} onClick={clearCarriedChatAbout}>
        ×
      </button>
    </p>
  );
}
