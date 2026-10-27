import { useEffect, type ReactNode } from "react";
import { languages, useI18n, type Language } from "../i18n";
import { useTheme } from "../shell/theme";
import { Button, Chip, SelectField } from "../ui";
import { Icon } from "../ui/Icon";
import "./entry.css";

const names: Record<Language, string> = {
  en: "English",
  de: "Deutsch",
  sw: "Kiswahili",
  es: "Español",
  fr: "Français",
  zh: "中文",
};

const languageOptions = languages.map((code) => ({ value: code, label: names[code] }));

function useTranslatedTitle() {
  const { t } = useI18n();
  const title = t("title");
  useEffect(() => {
    if (title !== "title") document.title = title;
  }, [title]);
}

export function EntryScreen({ children, onSignOut }: { children: ReactNode; onSignOut?: () => void }) {
  const { lang, setLang, t } = useI18n();
  useTheme();
  useTranslatedTitle();
  return (
    <div className="app bare ent-win">
      <header className="bare-top">
        <span />
        <div className="top-end">
          {onSignOut ? (
            <Button kind="quiet" size="sm" icon="logout" onClick={onSignOut}>
              {t("signOut")}
            </Button>
          ) : null}
          <SelectField
            icon="globe"
            label={t("field.language")}
            value={lang}
            options={languageOptions}
            onChange={(code) => setLang(code as Language)}
          />
        </div>
      </header>
      <div className="bare-body">
        <div className="ent-mark">
          <span className="logo">
            <Icon name="logo" size={28} stroke={2.2} />
          </span>
          <span className="brand">Hub Steward</span>
          <Chip kind="mute">Demo</Chip>
        </div>
        {children}
      </div>
    </div>
  );
}
