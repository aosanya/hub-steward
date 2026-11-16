import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../features/entry/language";
import { LanguageChoice } from "../../shared/ui/LanguageChoice";
import { Shell } from "../../shared/ui/Shell";

export function LanguagePage() {
  const { words } = useLanguage();
  const navigate = useNavigate();
  const back = () => navigate(-1);
  return (
    <Shell tabless title={words.changeLanguage} onBack={back}>
      <LanguageChoice onChosen={back} />
    </Shell>
  );
}
