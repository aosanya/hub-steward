import { Route } from "react-router-dom";
import { AppThreadPage } from "./thread/AppThreadPage";
import { buyInputsSource } from "./thread/marketSource";
import { sellHarvestSource } from "./thread/sellSource";

export const appsRoutes = () => (
  <>
    <Route path="/apps/buy" element={<AppThreadPage appName="Buy inputs" source={buyInputsSource} backTo="/do-something" backLabel="Do Something" />} />
    <Route path="/apps/sell" element={<AppThreadPage appName="Sell harvest" source={sellHarvestSource} backTo="/do-something" backLabel="Do Something" />} />
  </>
);
