import { forgetOpenAgency } from "../agency/open";
import { runtimeConfig } from "../wakala/config";
import { resetMcp } from "../wakala/mcp";
import { endSession } from "../wakala/me";

const tellTheServer = async () => {
  try {
    const { wakala } = await runtimeConfig();
    await fetch(`${wakala}/auth/signout`, { method: "POST", credentials: "include" });
  } catch {
    return;
  }
};

export const signOut = async () => {
  await tellTheServer();
  resetMcp();
  endSession();
  forgetOpenAgency();
};
