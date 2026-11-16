import { forgetOpenAgency } from "../../shared/wakala/openAgency";
import { runtimeConfig } from "../../shared/wakala/config";
import { resetMcp } from "../../shared/wakala/mcp";
import { endSession } from "../../shared/wakala/me";

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
