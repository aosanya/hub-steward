import { runtimeConfig } from "../wakala/config";

export type PasswordOutcome = "in" | "wrong" | "busy" | "unavailable" | "offline";

export const signInWithPassword = async (email: string, password: string): Promise<PasswordOutcome> => {
  if (email === "" || password === "") return "wrong";
  try {
    const { wakala } = await runtimeConfig();
    const res = await fetch(`${wakala}/auth/signin`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) return "in";
    if (res.status === 400 || res.status === 401) return "wrong";
    if (res.status === 429) return "busy";
    return "unavailable";
  } catch {
    return "offline";
  }
};
