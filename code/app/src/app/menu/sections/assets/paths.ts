import { screen } from "../../../screen";

export const assetPaths = {
  routes: screen("/menu/assets/routes"),
  equipment: screen("/menu/assets/equipment"),
  facilities: screen("/menu/assets/facilities"),
  buildings: screen("/menu/assets/buildings"),
  workOrders: screen("/menu/assets/work-orders"),
  workOrderNew: screen("/menu/assets/work-orders/new"),
  assetNew: screen("/menu/assets/assets/new"),
  maintenance: screen("/menu/assets/maintenance-schedule"),
  maintenanceNew: screen("/menu/assets/maintenance-schedule/new"),
};

export const maintenancePaths = {
  list: screen("/menu/assets/maintenance-records"),
  record: screen("/menu/assets/maintenance-records/:rowId"),
  edit: screen("/menu/assets/maintenance-records/:id/edit"),
  add: screen("/menu/assets/maintenance-records/new"),
};

export const workOrderEditPath = screen("/menu/assets/work-orders/:id/edit");

export const assetEditPath = screen("/menu/assets/assets/:id/edit");

export const scheduleEditPath = screen("/menu/assets/maintenance-schedule/:scheduleId/edit");

const pathOfCategory: Record<string, (query: Record<string, string>) => string> = {
  Route: (query) => assetPaths.routes.path(query),
  Equipment: (query) => assetPaths.equipment.path(query),
  Facility: (query) => assetPaths.facilities.path(query),
  Building: (query) => assetPaths.buildings.path(query),
};

export const assetPathOf = (category: string, assetId: string) => pathOfCategory[category]?.({ item: assetId }) ?? "";

export const assetListPath = (category: string) => pathOfCategory[category]?.({}) ?? assetPaths.routes.path();
