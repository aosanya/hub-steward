import { useState } from "react";
import { useI18n } from "../../i18n";

type NumberControlProps = { label: string; digits: string; applies: boolean; onChange: (digits: string) => void };

const digitsOf = (typed: string) => typed.replace(/\D/g, "");

export function NumberControl({ label, digits, applies, onChange }: NumberControlProps) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(false);
  const shown = !applies ? t("agentNoLimit") : editing || digits === "" ? digits : Number(digits).toLocaleString(lang);

  return (
    <span className={applies ? "control ctl" : "control ctl off"}>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        placeholder="0"
        value={shown}
        disabled={!applies}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) => onChange(digitsOf(e.target.value))}
      />
    </span>
  );
}
