import { useNavigate } from "react-router-dom";
import { useLanguage } from "../entry/language";
import { LanguageChoice } from "../ui/LanguageChoice";
import { Shell } from "../ui/Shell";

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
