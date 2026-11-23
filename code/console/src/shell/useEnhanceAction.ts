import { useContext, useState } from "react";
import { UNSAFE_LocationContext } from "react-router-dom";
import { draftBackground } from "../data/enhanceBackground";
import { isAgencyContentPage } from "../data/menu";
import { useI18n } from "../i18n";
import type { HeaderAction } from "../ui/props";
import { useAskChat } from "./chatTell";
import { ConsoleCtx } from "./context";
import { pageLabel } from "./labels";

const keepsCase = ["de"];

export function useEnhanceAction(): HeaderAction | null {
  const shell = useContext(ConsoleCtx);
  const { t, lang } = useI18n();
  const ask = useAskChat();
  const search = useContext(UNSAFE_LocationContext)?.location.search ?? "";
  const [reading, setReading] = useState(0);
  const [queued, setQueued] = useState(0);
  if (!shell || !isAgencyContentPage(shell.page) || search) return null;
  const label = pageLabel(t, shell.page);
  const name = keepsCase.includes(lang) ? label : label.toLocaleLowerCase(lang);
  const send = async () => {
    setReading((now) => now + 1);
    const background = await draftBackground(shell.hub.id, shell.page).catch(() => "");
    setReading((now) => now - 1);
    setQueued((now) => now + 1);
    ask(t("enhance.message").replace("{page}", name), background, undefined, () => setQueued((now) => now - 1));
  };
  return { label: t("enhance.button"), icon: "wand", busy: reading + queued > 0, onClick: send };
}
