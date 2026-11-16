import { Route } from "react-router-dom";
import { financePaths } from "./paths";
import { PaymentsScreen } from "./PaymentsScreen";
import { ProcurementScreen } from "./ProcurementScreen";
import { RevenueBillingScreen } from "./RevenueBillingScreen";

export { PaymentsScreen, ProcurementScreen, RevenueBillingScreen };

export const items = [
  { title: "Revenue & Billing", path: () => financePaths.revenueAndBilling.path() },
  { title: "Procurement", path: () => financePaths.procurement.path() },
  { title: "Payments", path: () => financePaths.payments.path() },
];

export const routes = () => (
  <>
    <Route path={financePaths.revenueAndBilling.pattern} element={<RevenueBillingScreen />} />
    <Route path={financePaths.procurement.pattern} element={<ProcurementScreen />} />
    <Route path={financePaths.payments.pattern} element={<PaymentsScreen />} />
  </>
);
