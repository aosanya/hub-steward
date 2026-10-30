export const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`set ${name} in the environment`);
  return value;
};

export const settings = () => ({
  baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5190",
  apiURL: need("E2E_API_URL"),
  email: need("E2E_EMAIL"),
  password: need("E2E_PASSWORD"),
  hubName: process.env.E2E_HUB_NAME ?? "Siaya Farmers' Group",
  serverLog: need("E2E_SERVER_LOG"),
  shotsDir: need("E2E_SHOTS_DIR"),
  accountName: process.env.E2E_ACCOUNT_NAME ?? "Muse Spark 1.3",
});

export type Settings = ReturnType<typeof settings>;
