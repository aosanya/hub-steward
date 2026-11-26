import { mcpAgencyClient, word, type AgencyClient, type AgencyView } from "./modules";
import { useWord, type Wording } from "./useWord";

const currencyWord = "Currency";

export const currencyUnitFromWording = (wording: Wording) => {
  const own = wording(currencyWord);
  return own === currencyWord ? "" : own;
};

export const currencyUnitOfView = (view: AgencyView | null | undefined) => currencyUnitFromWording((generic) => word(view, generic, "accounting"));

export const loadCurrencyUnit = async (agency: AgencyClient = mcpAgencyClient) => {
  try {
    return currencyUnitOfView(await agency.read());
  } catch {
    return "";
  }
};

export const useCurrencyUnit = () => currencyUnitFromWording(useWord("accounting"));
