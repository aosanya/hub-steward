export type Template = { id: string; nameKey: string; icon: string; roles: number; goals: number };

export const templates: Template[] = [
  { id: "siaya-lab", nameKey: "templateLab", icon: "laptop", roles: 3, goals: 4 },
  { id: "farmers", nameKey: "templateFarmers", icon: "wheat", roles: 9, goals: 4 },
  { id: "boda-boda-riders", nameKey: "templateRiders", icon: "bike", roles: 8, goals: 5 },
  { id: "logistics-freight-company", nameKey: "templateFreight", icon: "truck", roles: 11, goals: 4 },
  { id: "agricultural-drone-crop-spraying-service", nameKey: "templateDrone", icon: "send", roles: 11, goals: 3 },
  { id: "clinical-research-organization", nameKey: "templateClinical", icon: "pulse", roles: 13, goals: 3 },
  { id: "electric-grid-utility", nameKey: "templateGrid", icon: "plug", roles: 11, goals: 4 },
  { id: "mobile-money-operator", nameKey: "templateMoney", icon: "wifi", roles: 10, goals: 3 },
];

export const templateOf = (id: string): Template => templates.find((template) => template.id === id) ?? templates[0];
