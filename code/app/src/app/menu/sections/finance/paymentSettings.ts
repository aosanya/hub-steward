import { callTool } from "../../../../shared/wakala/mcp";

export const overpaymentKey = "payment_overpayment";

export const methodsKey = "payment_methods";

export const defaultPaymentMethods = ["Cash", "Bank transfer", "Card", "Other"];

const readTool = "forms_catalog_setting_read";

const writeTool = "forms_catalog_setting_write";

const isMissing = (error: unknown) => error instanceof Error && /not found/i.test(error.message);

const readValue = async (key: string): Promise<string | null> => {
  try {
    const reply = (await callTool("", readTool, { key })) as { value?: unknown } | null;
    return typeof reply?.value === "string" ? reply.value : null;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
};

const methodsOf = (value: string | null): string[] => {
  if (value === null) return defaultPaymentMethods;
  try {
    const parsed: unknown = JSON.parse(value);
    const names = Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string" && name.trim() !== "") : [];
    return names.length > 0 ? names : defaultPaymentMethods;
  } catch {
    return defaultPaymentMethods;
  }
};

export const loadPaymentMethods = async (): Promise<string[]> => {
  try {
    return methodsOf(await readValue(methodsKey));
  } catch {
    return defaultPaymentMethods;
  }
};

export type PaymentSettings = { overpayment: boolean; methods: string[] };

export const loadPaymentSettings = async (): Promise<PaymentSettings> => {
  const [overpayment, methods] = await Promise.all([readValue(overpaymentKey), readValue(methodsKey)]);
  return { overpayment: overpayment === "allowed", methods: methodsOf(methods) };
};

export const savePaymentSettings = async (was: PaymentSettings, now: PaymentSettings) => {
  if (was.overpayment !== now.overpayment) await callTool("", writeTool, { key: overpaymentKey, value: now.overpayment ? "allowed" : "refused" });
  if (JSON.stringify(was.methods) !== JSON.stringify(now.methods)) await callTool("", writeTool, { key: methodsKey, value: JSON.stringify(now.methods) });
};

export const methodProblem = (methods: string[], name: string) => {
  const given = name.trim();
  if (given === "") return "Give the way to pay a name.";
  const repeat = methods.find((way) => way.toLowerCase() === given.toLowerCase());
  return repeat ? `${repeat} is already a way to pay.` : "";
};
