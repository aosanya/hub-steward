import { useBackOrHome } from "../../app/useBackOrHome";
import { useLanguage } from "../../shared/language/language";
import { LanguageChoice } from "../../shared/ui/LanguageChoice";
import { Shell } from "../../app/Shell";

export function LanguagePage() {
  const { words } = useLanguage();
  const back = useBackOrHome();
  return (
    <Shell tabless title={words.changeLanguage} onBack={back}>
      <LanguageChoice onChosen={back} />
    </Shell>
  );
}
