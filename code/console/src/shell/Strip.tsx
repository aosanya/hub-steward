import { Fragment } from "react";
import { Link } from "react-router-dom";
import { hubPath } from "../api";
import { crumbsOf } from "../data/menu";
import { languages, useI18n, type Language } from "../i18n";
import type { Hub } from "../types";
import { SelectField } from "../ui";
import { Icon } from "../ui/Icon";
import { HubSwitcher } from "./HubSwitcher";
import { pageLabel } from "./labels";

type StripProps = { hubs: Hub[]; hub: Hub; page: string };

export const languageNames: Record<Language, string> = {
  en: "English",
  de: "Deutsch",
  sw: "Kiswahili",
  es: "Español",
  fr: "Français",
  zh: "中文",
  hu: "Magyar",
};

const languageOptions = languages.map((code) => ({ value: code, label: languageNames[code] }));

function Crumbs({ hubId, page }: { hubId: string; page: string }) {
  const { t } = useI18n();
  const { section, parent, last } = crumbsOf(page);
  const steps = [
    section ? <span key="section">{t(section)}</span> : null,
    parent ? (
      <Link key="parent" to={hubPath(hubId, parent)}>
        {pageLabel(t, parent)}
      </Link>
    ) : null,
    <span key="last" className="crumb-now">
      {pageLabel(t, last)}
    </span>,
  ].filter((step) => step !== null);
  return (
    <div className="crumb">
      {steps.map((step, index) => (
        <Fragment key={step.key}>
          {index > 0 ? " / " : null}
          {step}
        </Fragment>
      ))}
    </div>
  );
}

export function Strip({ hubs, hub, page }: StripProps) {
  const { lang, setLang, t } = useI18n();
  return (
    <header className="strip">
      <div className="brand-row">
        <div className="logo">
          <Icon name="logo" size={18} stroke={2.2} />
        </div>
        <div className="brand">Hub Steward</div>
        <span className="demo">{t("demo")}</span>
      </div>
      <HubSwitcher hubs={hubs} hub={hub} page={page} />
      <span className="strip-div" />
      <Crumbs hubId={hub.id} page={page} />
      <div className="strip-end">
        <SelectField icon="globe" label={t("language")} value={lang} options={languageOptions} onChange={(code) => setLang(code as Language)} />
      </div>
    </header>
  );
}
