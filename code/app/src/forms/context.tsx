import { createContext, useContext, type ReactNode } from "react";
import { liveClient, type FormsClient } from "./api";

const FormsContext = createContext<FormsClient>(liveClient);

export function FormsProvider({ client, children }: { client: FormsClient; children: ReactNode }) {
  return <FormsContext.Provider value={client}>{children}</FormsContext.Provider>;
}

export const useForms = () => useContext(FormsContext);
