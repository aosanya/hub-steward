import { callTool } from "../wakala/mcp";

export type Profile = { name: string; code: string; phone: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");

export const profileOf = (actor: any): Profile => ({
  name: text(actor?.display_name).trim(),
  code: text(actor?.public_code),
  phone: text(actor?.attributes?.phone),
});

export const readProfile = async (): Promise<Profile> => profileOf(await callTool("", "actor_get_my_actor"));

export const correctPhone = async (phone: string): Promise<Profile> =>
  profileOf(await callTool("", "actor_correct_my_attributes", { attributes: { phone } }));
