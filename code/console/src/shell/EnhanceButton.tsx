import { useContext, useState } from "react";
import { useLocation } from "react-router-dom";
import { draftBackground } from "../data/enhanceBackground";
import { isAgencyContentPage } from "../data/menu";
import { useI18n } from "../i18n";
import { Button } from "../ui/Button";
import { useAskChat } from "./chatTell";
import { ConsoleCtx } from "./context";
import { pageLabel } from "./labels";

const keepsCase = ["de"];

function Enhance({ hubId, page }: { hubId: string; page: string }) {
  const { t, lang } = useI18n();
  const ask = useAskChat();
  const { search } = useLocation();
  const [reading, setReading] = useState(0);
  const [queued, setQueued] = useState(0);
  if (search) return null;
  const label = pageLabel(t, page);
  const name = keepsCase.includes(lang) ? label : label.toLocaleLowerCase(lang);
  const send = async () => {
    setReading((now) => now + 1);
    const background = await draftBackground(hubId, page).catch(() => "");
    setReading((now) => now - 1);
    setQueued((now) => now + 1);
    ask(t("enhance.message").replace("{page}", name), background, undefined, () => setQueued((now) => now - 1));
  };
  const busy = reading + queued > 0;
  return (
    <Button kind="quiet" icon={busy ? undefined : "wand"} disabled={busy} aria-busy={busy} onClick={send}>
      {busy ? <span className="tool-spin" aria-hidden="true" /> : null}
      {t("enhance.button")}
    </Button>
  );
}

export function EnhanceButton() {
  const shell = useContext(ConsoleCtx);
  return shell && isAgencyContentPage(shell.page) ? (
    <Enhance hubId={shell.hub.id} page={shell.page} />
  ) : null;
}
