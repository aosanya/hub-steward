import { useLanguage } from "../entry/language";
import { languages } from "../entry/words";
import { Button } from "./Button";

export function LanguageChoice({ onChosen }: { onChosen: () => void }) {
  const { code: language, setLanguage } = useLanguage();
  return (
    <>
      {languages.map((l) => (
        <Button
          key={l.code}
          kind={l.code === language ? "primary" : "quiet"}
          lang={l.code}
          aria-pressed={l.code === language}
          onClick={() => {
            setLanguage(l.code);
            onChosen();
          }}
        >
          {l.name}
        </Button>
      ))}
    </>
  );
}
