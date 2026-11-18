import { Route } from "react-router-dom";
import { AssetFormScreen } from "./AssetFormScreen";
import { BuildingsPage, EquipmentPage, FacilitiesPage, RoutesPage } from "./AssetCategoryPages";
import { MaintenanceListScreen } from "./MaintenanceList";
import { MaintenanceAddScreen, MaintenanceEditScreen, MaintenanceRecordScreen } from "./MaintenanceScreens";
import { assetEditPath, assetPaths, maintenancePaths, scheduleEditPath, workOrderEditPath } from "./paths";
import { ScheduleEditScreen } from "./ScheduleEdit";
import { WorkOrderFormScreen } from "./WorkOrderFormScreen";
import { MaintenancePage, WorkOrdersPage } from "./WorkPages";

export const items = [
  { title: "Routes", path: () => assetPaths.routes.path() },
  { title: "Equipment", path: () => assetPaths.equipment.path() },
  { title: "Facilities", path: () => assetPaths.facilities.path() },
  { title: "Buildings", path: () => assetPaths.buildings.path() },
  { title: "Work Orders", path: () => assetPaths.workOrders.path() },
  { title: "Maintenance Schedule", path: () => assetPaths.maintenance.path() },
];

export const routes = () => (
  <>
    <Route path={assetPaths.routes.pattern} element={<RoutesPage />} />
    <Route path={assetPaths.equipment.pattern} element={<EquipmentPage />} />
    <Route path={assetPaths.facilities.pattern} element={<FacilitiesPage />} />
    <Route path={assetPaths.buildings.pattern} element={<BuildingsPage />} />
    <Route path={assetPaths.assetNew.pattern} element={<AssetFormScreen />} />
    <Route path={assetEditPath.pattern} element={<AssetFormScreen />} />
    <Route path={assetPaths.workOrders.pattern} element={<WorkOrdersPage />} />
    <Route path={assetPaths.workOrderNew.pattern} element={<WorkOrderFormScreen />} />
    <Route path={workOrderEditPath.pattern} element={<WorkOrderFormScreen />} />
    <Route path={assetPaths.maintenance.pattern} element={<MaintenancePage />} />
    <Route path={assetPaths.maintenanceNew.pattern} element={<ScheduleEditScreen />} />
    <Route path={scheduleEditPath.pattern} element={<ScheduleEditScreen />} />
    <Route path={maintenancePaths.list.pattern} element={<MaintenanceListScreen />} />
    <Route path={maintenancePaths.add.pattern} element={<MaintenanceAddScreen />} />
    <Route path={maintenancePaths.record.pattern} element={<MaintenanceRecordScreen />} />
    <Route path={maintenancePaths.edit.pattern} element={<MaintenanceEditScreen />} />
  </>
);
