import { useI18n } from "../i18n";
import { Icon } from "./Icon";
import type { ThemePickerProps } from "./props";
import { themeChoices } from "./themes";

export function ThemePicker({ value, onChange, themes = themeChoices }: ThemePickerProps) {
  const { t } = useI18n();
  return (
    <div className="theme-picker" role="radiogroup" aria-label={t("ui.theme")}>
      {themes.map((theme) => {
        const on = theme.key === value;
        const label = t("ui.theme." + theme.key);
        return (
          <label key={theme.key} className={on ? "theme-card on" : "theme-card"}>
            <input
              className="sr"
              type="radio"
              name="theme"
              value={theme.key}
              checked={on}
              onChange={() => onChange?.(theme.key)}
            />
            <span className="theme-dots">
              {theme.colours.map((colour) => (
                <i key={colour} style={{ background: colour }} />
              ))}
            </span>
            <span>{label === "ui.theme." + theme.key ? theme.label : label}</span>
            {on ? <Icon name="check" size={14} stroke={3} className="theme-check" /> : null}
          </label>
        );
      })}
    </div>
  );
}
