import { screen } from "../../../screen";

export const assetPaths = {
  routes: screen("/menu/assets/routes"),
  equipment: screen("/menu/assets/equipment"),
  facilities: screen("/menu/assets/facilities"),
  buildings: screen("/menu/assets/buildings"),
  workOrders: screen("/menu/assets/work-orders"),
  maintenance: screen("/menu/assets/maintenance-schedule"),
};

const pathOfCategory: Record<string, (query: Record<string, string>) => string> = {
  Route: (query) => assetPaths.routes.path(query),
  Equipment: (query) => assetPaths.equipment.path(query),
  Facility: (query) => assetPaths.facilities.path(query),
  Building: (query) => assetPaths.buildings.path(query),
};

export const assetPathOf = (category: string, assetId: string) => pathOfCategory[category]?.({ item: assetId }) ?? "";
