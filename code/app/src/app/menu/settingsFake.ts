export type Settings = Record<string, string>;

export const settingsOf = (chosen: Record<string, unknown>): Settings =>
  Object.fromEntries(Object.entries(chosen).map(([key, value]) => [key, JSON.stringify(value)]));

export const settingReply = (settings: Settings, tool: string, args: unknown) => {
  const given = (args ?? {}) as Record<string, string>;
  if (tool === "forms_catalog_setting_read") return given.key in settings ? { key: given.key, value: settings[given.key] } : null;
  if (tool === "forms_catalog_setting_write") {
    settings[given.key] = given.value;
    return {};
  }
  return undefined;
};

export const answersOf = (settings: Settings, key: string): Record<string, string> | undefined =>
  key in settings ? JSON.parse(settings[key]).answers : undefined;
