export const keeperPeople = [
  { id: "p1", display_name: "Nagy Réka" },
  { id: "p2", first_name: "Gábor", last_name: "Horváth" },
  { id: "p3", display_name: "Tóth Márton", code: "M-1" },
  { id: "p4", display_name: "Tóth Márton", code: "M-2" },
];

export const keeperGroups = [
  { id: "g1", name: "Street Lighting Crew", node_type: "crew" },
  { id: "g2", name: "Road Repair Crew", node_type: "crew" },
  { id: "g3", name: "Public Works Department", node_type: "department" },
];

export const keeperChoiceNames = ["Nagy Réka", "Gábor Horváth", "Tóth Márton", "Tóth Márton", "Street Lighting Crew", "Road Repair Crew", "Public Works Department"];

export const answerActors = (name: string, args: unknown): Promise<unknown> | undefined => {
  const given = (args ?? {}) as Record<string, string>;
  if (name === "actor_list_actors") return Promise.resolve({ items: keeperPeople });
  if (name === "actor_list_groups") return Promise.resolve({ items: keeperGroups });
  if (name === "actor_get_actor") {
    const found = keeperPeople.find((person) => person.id === given.actor_id);
    return found ? Promise.resolve({ item: found }) : Promise.reject(new Error("actor: not found"));
  }
  if (name === "actor_get_group") {
    const found = keeperGroups.find((group) => group.id === given.group_id);
    return found ? Promise.resolve({ item: found }) : Promise.reject(new Error("group: not found"));
  }
  return undefined;
};
