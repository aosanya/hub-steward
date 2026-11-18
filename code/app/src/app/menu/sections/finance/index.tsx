import { Route } from "react-router-dom";
import { BillsScreen } from "./BillsScreen";
import { BudgetScreen } from "./BudgetScreen";
import { NeighbourhoodSpendingScreen } from "./NeighbourhoodSpendingScreen";
import { PaymentListScreen } from "./PaymentListScreen";
import { ReportsScreen } from "./ReportsScreen";
import { TendersScreen } from "./TendersScreen";
import { UpwardReportScreen } from "./UpwardReportScreen";
import { financePaths } from "./paths";

export { BillsScreen, BudgetScreen, NeighbourhoodSpendingScreen, PaymentListScreen, ReportsScreen, TendersScreen };

export const items = [
  { title: "Budget", path: () => financePaths.budget.path() },
  { title: "Spending by Neighbourhood", path: () => financePaths.spendingByNeighbourhood.path() },
  { title: "Revenue & Billing", path: () => financePaths.revenueAndBilling.path() },
  { title: "Procurement", path: () => financePaths.procurement.path() },
  { title: "Payments", path: () => financePaths.payments.path() },
  { title: "Financial Reports", path: () => financePaths.reports.path() },
  { title: "National Report", path: () => financePaths.nationalReport.path() },
];

export const routes = () => (
  <>
    <Route path={financePaths.budget.pattern} element={<BudgetScreen />} />
    <Route path={financePaths.spendingByNeighbourhood.pattern} element={<NeighbourhoodSpendingScreen />} />
    <Route path={financePaths.revenueAndBilling.pattern} element={<BillsScreen />} />
    <Route path={financePaths.procurement.pattern} element={<TendersScreen />} />
    <Route path={financePaths.payments.pattern} element={<PaymentListScreen />} />
    <Route path={financePaths.reports.pattern} element={<ReportsScreen />} />
    <Route path={financePaths.nationalReport.pattern} element={<UpwardReportScreen />} />
  </>
);
